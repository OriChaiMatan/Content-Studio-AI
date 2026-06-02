import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Icon } from '../../../components/ui/Icon';
import { Input, Textarea } from '../../../components/ui/Input';
import type { WizardFormData, SourceType } from '../../../types';

interface Props {
  form: WizardFormData;
  update: <K extends keyof WizardFormData>(key: K, value: WizardFormData[K]) => void;
}

type NewSource = { type: SourceType; label: string; content: string };

const emptySource: NewSource = { type: 'text', label: '', content: '' };

const sourceTypeConfig: { value: SourceType; label: string; icon: string }[] = [
  { value: 'text', label: 'Text',  icon: 'notes' },
  { value: 'url',  label: 'URL',   icon: 'link' },
  { value: 'pdf',  label: 'PDF',   icon: 'picture_as_pdf' },
];

export function Step4Sources({ form, update }: Props) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<NewSource>(emptySource);

  function addSource() {
    if (!draft.content.trim()) return;
    update('sources', [
      ...form.sources,
      { type: draft.type, label: draft.label || draft.type, content: draft.content },
    ]);
    setDraft(emptySource);
    setAdding(false);
  }

  function removeSource(i: number) {
    update('sources', form.sources.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-4">
      <p className="text-[14px] text-on-surface-variant">
        Add research sources: text notes, URLs, or PDFs. The AI will use these as the foundation for all content.
      </p>

      {/* Existing sources */}
      {form.sources.length > 0 && (
        <div className="space-y-2">
          {form.sources.map((source, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-surface-container-low rounded-lg border border-outline-variant/30">
              <Icon name={sourceTypeConfig.find(t => t.value === source.type)?.icon ?? 'article'} className="text-outline shrink-0" size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-on-surface">{source.label}</p>
                <p className="text-[12px] text-on-surface-variant truncate">{source.content}</p>
              </div>
              <span className="text-[10px] uppercase font-bold text-outline bg-surface-container px-2 py-0.5 rounded">{source.type}</span>
              <button
                type="button"
                onClick={() => removeSource(i)}
                className="text-outline hover:text-error transition-colors shrink-0"
              >
                <Icon name="delete" size="sm" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add source form */}
      {adding ? (
        <div className="bg-surface-container-low rounded-xl p-5 border border-primary/20 space-y-4">
          <div className="flex gap-2">
            {sourceTypeConfig.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => setDraft(d => ({ ...d, type: t.value, content: '' }))}
                className={[
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[13px] font-medium transition-colors',
                  draft.type === t.value
                    ? 'bg-primary text-on-primary border-primary'
                    : 'border-outline-variant text-on-surface-variant hover:bg-surface-container',
                ].join(' ')}
              >
                <Icon name={t.icon} size="sm" />
                {t.label}
              </button>
            ))}
          </div>

          <Input
            label="Label (optional)"
            type="text"
            value={draft.label}
            onChange={e => setDraft(d => ({ ...d, label: e.target.value }))}
            placeholder={`e.g. MIT Research Paper`}
          />

          {draft.type === 'text' ? (
            <Textarea
              label="Text Content *"
              value={draft.content}
              onChange={e => setDraft(d => ({ ...d, content: e.target.value }))}
              placeholder="Paste your research notes, background information, or any text content..."
              rows={4}
            />
          ) : draft.type === 'url' ? (
            <Input
              label="URL *"
              type="url"
              value={draft.content}
              onChange={e => setDraft(d => ({ ...d, content: e.target.value }))}
              placeholder="https://..."
            />
          ) : (
            <div className="border-2 border-dashed border-outline-variant rounded-lg p-6 text-center">
              <Icon name="upload_file" size="xl" className="text-outline mx-auto mb-2" />
              <p className="text-[14px] text-on-surface-variant mb-1">PDF upload coming soon</p>
              <p className="text-[12px] text-outline">Enter a filename for now</p>
              <Input
                type="text"
                value={draft.content}
                onChange={e => setDraft(d => ({ ...d, content: e.target.value }))}
                placeholder="report.pdf"
                className="mt-3"
              />
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => { setAdding(false); setDraft(emptySource); }}>
              Cancel
            </Button>
            <Button size="sm" onClick={addSource} disabled={!draft.content.trim()}>
              <Icon name="add" size="sm" />
              Add Source
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full border-2 border-dashed border-outline-variant rounded-xl p-5 flex items-center justify-center gap-2 hover:bg-surface-container/50 hover:border-primary/30 transition-all text-outline hover:text-primary"
        >
          <Icon name="add_circle" />
          <span className="text-[14px] font-medium">Add Source</span>
        </button>
      )}

      <p className="text-[12px] text-on-surface-variant">
        {form.sources.length === 0
          ? 'You can also skip this step and add sources later.'
          : `${form.sources.length} source${form.sources.length !== 1 ? 's' : ''} added.`}
      </p>
    </div>
  );
}
