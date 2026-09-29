import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeepGeneratingModal } from './deep-generating-modal';

const stages = [
  ['preparing', '正在整理基础职业倾向'],
  ['constraints', '正在识别现实限制'],
  ['capital', '正在评估可迁移职业资本'],
  ['researching', '正在核对职业市场证据'],
  ['converging', '正在收窄候选职业方向'],
  ['validating', '正在生成低成本验证路径'],
] as const;

afterEach(() => cleanup());

describe('DeepGeneratingModal', () => {
  it.each(stages)('renders the real %s pipeline stage', (stage, title) => {
    render(<DeepGeneratingModal stage={stage} />);

    expect(screen.getByRole('dialog', { name: '正在生成深度报告' })).toBeTruthy();
    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.queryByText(/\d+%/)).toBeNull();
  });

  it('offers an accessible cancellation path', () => {
    const onCancel = vi.fn();
    render(<DeepGeneratingModal onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: '取消生成' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
