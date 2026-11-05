import { Config } from '@src/models/dic_config.model';
import { AuditTrail } from '@src/models/audit_trail.model';
import { AILLMVoiceTranscript } from '@src/models/mst_ai_llm_voice_transcript';
import AILLMVoiceTranscriptService, {
  AI_LLM_VOICE_TRANSCRIPT_NOT_FOUND_ERR,
} from '@src/services/AILLMVoiceTranscriptService';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { RouteError } from '@src/other/classes';

const ROWS = [
  { key: 'record_transcribe_webapp', is_enabled: false },
  { key: 'record_transcribe_mobile', is_enabled: false },
  { key: 'feed_ai_ddx', is_enabled: true },
  { key: 'autofill_doctor_notes', is_enabled: false },
];

describe('AILLMVoiceTranscriptService', () => {

  let configUpdate: jasmine.Spy;
  let auditCreate: jasmine.Spy;
  let rowUpdate: jasmine.Spy;

  beforeEach(() => {
    configUpdate = spyOn(Config, 'update').and.resolveTo([1]);
    auditCreate = spyOn(AuditTrail, 'create').and.resolveTo();
    rowUpdate = spyOn(AILLMVoiceTranscript, 'update').and.resolveTo([1]);
  });

  it('lists rows ordered by id ascending', async () => {
    const findAll = spyOn(AILLMVoiceTranscript, 'findAll')
      .and.resolveTo([] as AILLMVoiceTranscript[]);
    await AILLMVoiceTranscriptService.getAll();
    expect(findAll.calls.mostRecent().args[0]?.order)
      .toEqual([['id', 'ASC']]);
  });

  it('rebuilds the ai_llm_voice_transcript dic_config json', async () => {
    spyOn(AILLMVoiceTranscript, 'findOne').and.resolveTo(
      { key: 'feed_ai_ddx', is_enabled: false } as AILLMVoiceTranscript,
    );
    spyOn(AILLMVoiceTranscript, 'findAll')
      .and.resolveTo(ROWS as AILLMVoiceTranscript[]);

    await AILLMVoiceTranscriptService.updateIsEnabled('3', true, 'u1', 'Tester');

    expect(rowUpdate).toHaveBeenCalledWith(
      { is_enabled: true }, { where: { id: '3' } },
    );
    expect(configUpdate).toHaveBeenCalledWith(
      {
        value: JSON.stringify({
          record_transcribe_webapp: false,
          record_transcribe_mobile: false,
          feed_ai_ddx: true,
          autofill_doctor_notes: false,
        }),
        published: false,
      },
      { where: { key: 'ai_llm_voice_transcript' } },
    );
    expect(auditCreate).toHaveBeenCalledWith(jasmine.objectContaining({
      user_id: 'u1',
      user_name: 'Tester',
      activity_type: 'AI LLM VOICE TRANSCRIPT CONFIG UPDATED',
      description: 'Enabled "feed_ai_ddx" config.',
    }));
  });

  it('does nothing when the status is unchanged', async () => {
    spyOn(AILLMVoiceTranscript, 'findOne').and.resolveTo(
      { key: 'feed_ai_ddx', is_enabled: true } as AILLMVoiceTranscript,
    );
    await AILLMVoiceTranscriptService.updateIsEnabled('3', true, 'u1', 'Tester');
    expect(rowUpdate).not.toHaveBeenCalled();
    expect(configUpdate).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it('throws not found for an unknown id', async () => {
    spyOn(AILLMVoiceTranscript, 'findOne').and.resolveTo(null);
    await expectAsync(
      AILLMVoiceTranscriptService.updateIsEnabled('999', true, 'u1', 'Tester'),
    ).toBeRejectedWith(new RouteError(
      HttpStatusCodes.NOT_FOUND, AI_LLM_VOICE_TRANSCRIPT_NOT_FOUND_ERR,
    ));
    expect(configUpdate).not.toHaveBeenCalled();
  });
});
