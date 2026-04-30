import type { RunSummary, SubmissionState } from '../types'
import { createDefaultSubmissionState } from '../types'
import type { BridgeEventBus } from './events'

export class BridgeSubmissionDomain {
  private submissionState = createDefaultSubmissionState()

  constructor(
    private readonly events: BridgeEventBus,
    private readonly getSessionRunSummary: () => RunSummary | null,
  ) {}

  // 更新提交状态并广播给 UI / 场景层。
  updateSubmissionState(submissionState: SubmissionState) {
    this.submissionState = submissionState
    this.events.emit('submission:state-changed', submissionState)
  }

  // 读取当前提交状态快照。
  getSubmissionState() {
    return this.submissionState
  }

  // 触发提交请求；未显式传入时默认提交当前会话 summary。
  requestSubmit(summary?: RunSummary | null) {
    this.events.emit('submission:submit-request', summary ?? this.getSessionRunSummary())
  }

  // 触发“清空提交结果”请求，用于下一局开始前复位 UI。
  requestClearSubmission() {
    this.events.emit('submission:clear-request', undefined)
  }
}
