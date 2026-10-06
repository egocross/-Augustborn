import { describe, expect, it } from 'vitest';
import { bankInvariantErrors, BankSchema, FIXED_QUESTIONS, FOLLOWUP_QUESTIONS, FixedAnswersInputSchema, QUESTION_BANK, ScanAnswerSchema } from './questions';
import { scoreAdvantageScan } from './scoring';

const base = ['investigative','investigative','realistic','artistic','social','social','investigate','structure','create','execute','independence','independence','achievement','none'];
function input(suffixes = base) { return { scanVersion: 'advantage-scan-v1.1', answers: suffixes.map((suffix, i) => ({questionId:`Q${i+1}`,optionId:`Q${i+1}.${suffix}`})) }; }

describe('frozen bank and answer identity', () => {
  it('retains all 14 fixed and nine follow-up questions, text, identities and display order', () => {
    expect(BankSchema.parse(QUESTION_BANK)).toEqual(QUESTION_BANK);
    expect(QUESTION_BANK.questions.filter(q => q.kind === 'fixed')).toHaveLength(14);
    expect(QUESTION_BANK.questions.filter(q => q.kind === 'followup')).toHaveLength(9);
    expect(QUESTION_BANK).toMatchSnapshot();
    expect(QUESTION_BANK.questions.find(q => q.questionId === 'Q8')?.options[5].optionId).toBe('Q8.investigate');
  });
  it('rejects mutated frozen banks, including duplicate positions and changed text', () => {
    for (const mutation of ['position','text','mapping','version','extra']) {
      const bank = structuredClone(QUESTION_BANK);
      if (mutation === 'position') bank.questions[0].options[1].displayOrder=1;
      if (mutation === 'text') bank.questions[0].prompt+='!';
      if (mutation === 'mapping') bank.questions[0].options[0].dimension='artistic';
      if (mutation === 'version') Object.assign(bank,{scanVersion:'advantage-scan-v1'});
      if (mutation === 'extra') Object.assign(bank,{clientScore:9});
      expect(BankSchema.safeParse(bank).success).toBe(false);
    }
  });
  it('rejects alphabetic, cross-question and forged client answer fields', () => {
    for (const value of [{questionId:'Q8',optionId:'A'}, {questionId:'Q8',optionId:'Q7.investigate'}, {questionId:'Q8',optionId:'Q8.investigate',dimension:'investigate'}, {questionId:'Q8',optionId:'Q8.investigate',displayOrder:6}]) expect(ScanAnswerSchema.safeParse(value).success).toBe(false);
    expect(ScanAnswerSchema.safeParse({questionId:'Q8',optionId:'Q8.investigate'}).success).toBe(true);
  });
  it('rejects missing, duplicate, unknown-version and additional-field submissions', () => {
    const complete = input();
    for (const invalid of [{...complete, answers:complete.answers.slice(1)}, {...complete,answers:[...complete.answers.slice(1),complete.answers[1]]}, {...complete,scanVersion:'advantage-scan-v1'}, {...complete,bazi:{}}]) expect(FixedAnswersInputSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('fixed deterministic scores', () => {
  it('derives exposures and preserves numerator and denominator without counting uncertainty', () => {
    const values = Array(13).fill('uncertain').concat('none');
    values[7]='investigate';
    const result=scoreAdvantageScan(input(values));
    expect(result.behavior.investigate).toEqual({raw:1,scheduledExposure:4,normalized:{numerator:1,denominator:4},evidenceIds:['scan:Q8.investigate']});
    expect(Object.values(result.interests).map(x=>x.scheduledExposure)).toEqual(Array(6).fill(4));
    expect(Object.values(result.values).map(x=>x.scheduledExposure)).toEqual(Array(6).fill(3));
    expect(result.uncertaintyBySection).toEqual({interests:6,behavior:3,values:3});
    expect(result.uncertaintyCount).toBe(12);
    expect(result.recentEvidence).toEqual({optionId:'Q14.none',signal:null,evidenceId:null,verification:'self_report_unverified'});
    expect(result.recentRecallMissing).toBe(true);
  });
  it('conserves each construct total and does not mutate or depend on answer order', () => {
    const original=input(); const before=structuredClone(original);
    const result=scoreAdvantageScan(original);
    expect(Object.values(result.interests).reduce((a,c)=>a+c.raw,0)).toBe(6);
    expect(Object.values(result.behavior).reduce((a,c)=>a+c.raw,0)).toBe(4);
    expect(Object.values(result.values).reduce((a,c)=>a+c.raw,0)).toBe(3);
    expect(scoreAdvantageScan({...original,answers:[...original.answers].reverse()})).toEqual(result);
    expect(original).toEqual(before);
  });
  it('records one recent self-report and never merges it into fixed scores', () => {
    const values=[...base]; values[13]='execute_influence';
    const result=scoreAdvantageScan(input(values));
    expect(result.recentEvidence).toEqual({optionId:'Q14.execute_influence',signal:'execute_influence',evidenceId:'scan:Q14.execute_influence',verification:'self_report_unverified'});
    expect(result.recentRecallMissing).toBe(false);
    expect(result.behavior).toEqual(scoreAdvantageScan(input()).behavior);
  });
});


describe('bank invariants independent of the frozen reference', () => {
  it('detects authored exposure, position, dimension, and identity defects', () => {
    expect(bankInvariantErrors(QUESTION_BANK)).toEqual([]);
    for (const mutation of ['exposure', 'position', 'duplicate', 'identity', 'section']) {
      const bank = structuredClone(QUESTION_BANK);
      const question = bank.questions[0];
      if (mutation === 'exposure') question.options.pop();
      if (mutation === 'position') question.options[1].displayOrder = 1;
      if (mutation === 'duplicate') question.options[1].dimension = question.options[0].dimension;
      if (mutation === 'identity') question.options[0].optionId = 'Q8.investigate';
      if (mutation === 'section') question.section = 'values';
      expect(bankInvariantErrors(bank).length).toBeGreaterThan(0);
    }
  });
  it('freezes shared bank lists to prevent one caller changing later scoring', () => {
    expect(Object.isFrozen(QUESTION_BANK)).toBe(true);
    expect(Object.isFrozen(FIXED_QUESTIONS)).toBe(true);
    expect(Object.isFrozen(FOLLOWUP_QUESTIONS)).toBe(true);
  });
  it('matches the counterbalance matrix including every ordinary dimension position', () => {
    const expected = [
      ['realistic','investigative','artistic','social'],
      ['investigative','artistic','enterprising','conventional'],
      ['social','realistic','conventional','enterprising'],
      ['artistic','enterprising','investigative','realistic'],
      ['enterprising','conventional','social','investigative'],
      ['conventional','social','realistic','artistic'],
      ['investigate','structure','create','execute','collaborate','influence'],
      ['structure','create','execute','collaborate','influence','investigate'],
      ['create','execute','collaborate','influence','investigate','structure'],
      ['execute','collaborate','influence','investigate','structure','create'],
      ['independence','achievement','relationships','support','recognition','workingConditions'],
      ['relationships','support','recognition','workingConditions','independence','achievement'],
      ['recognition','workingConditions','independence','achievement','relationships','support'],
    ];
    expect(FIXED_QUESTIONS.slice(0, 13).map(q => q.options.filter(o => o.responseKind === 'signal').map(o => o.dimension))).toEqual(expected);
  });
});
