import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { Input, Textarea } from '../../components/ui/Input';
import { useContentCasesStore } from '../../stores/contentCasesStore';
import type { ContentSource, SourceType } from '../../types';

// ── Helpers ───────────────────────────────────────────────

const SOURCE_TYPES: { value: SourceType; label: string; icon: string }[] = [
  { value: 'text', label: 'Text',  icon: 'notes' },
  { value: 'url',  label: 'URL',   icon: 'link' },
  { value: 'pdf',  label: 'PDF',   icon: 'picture_as_pdf' },
];

function sourceIcon(type: SourceType) {
  return SOURCE_TYPES.find(t => t.value === type)?.icon ?? 'article';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ── Add-source inline form ────────────────────────────────

interface AddFormProps {
  onAdd: (type: SourceType, label: string, content: string) => void;
  onCancel: () => void;
}

function AddSourceForm({ onAdd, onCancel }: AddFormProps) {
  const [type, setType]       = useState<SourceType>('text');
  const [label, setLabel]     = useState('');
  const [content, setContent] = useState('');

  function handleSubmit() {
    if (!content.trim()) return;
    onAdd(type, label, content);
  }

  return (
    <div className="bg-surface-container-low rounded-xl p-5 border border-primary/20 space-y-4">
      {/* Type selector */}
      <div className="flex gap-2">
        {SOURCE_TYPES.map(t => (
          <button
            key={t.value}
            type="button"
            onClick={() => { setType(t.value); setContent(''); }}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[13px] font-medium transition-colors',
              type === t.value
                ? 'bg-primary text-on-primary border-primary'
                : 'border-outline-variant text-on-surface-variant hover:bg-surface-container',
            ].join(' ')}
          >
            <Icon name={t.icon} size="sm" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Label */}
      <Input
        label="Label (optional)"
        type="text"
        value={label}
        onChange={e => setLabel(e.target.value)}
        placeholder={
          type === 'text' ? 'e.g. Research notes from interview' :
          type === 'url'  ? 'e.g. MIT Technology Review article' :
          'e.g. Industry Report Q1 2024'
        }
      />

      {/* Content field */}
      {type === 'text' && (
        <Textarea
          label="Content *"
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Paste notes, excerpts, findings, or any background information to include in the next generation run…"
          rows={5}
        />
      )}
      {type === 'url' && (
        <Input
          label="URL *"
          type="url"
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="https://…"
        />
      )}
      {type === 'pdf' && (
        <div className="space-y-3">
          <div className="border-2 border-dashed border-outline-variant rounded-lg p-6 text-center">
            <Icon name="upload_file" size="xl" className="text-outline mx-auto mb-2" />
            <p className="text-[14px] text-on-surface-variant mb-1">PDF upload — coming soon</p>
            <p className="text-[12px] text-outline">Enter the filename below to reference this document</p>
          </div>
          <Input
            label="Filename *"
            type="text"
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="e.g. research-report-2024.pdf"
          />
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={handleSubmit} disabled={!content.trim()}>
          <Icon name="add" size="sm" />
          Add Source
        </Button>
      </div>
    </div>
  );
}

// ── Source row ────────────────────────────────────────────

interface SourceRowProps {
  source: ContentSource;
  caseId: string;
  onDelete: (id: string) => void;
  onSaveEdit: (id: string, label: string, content: string) => void;
}

function SourceRow({ source, caseId: _caseId, onDelete, onSaveEdit }: SourceRowProps) {
  const [editing, setEditing]   = useState(false);
  const [editLabel, setEditLabel] = useState(source.label);
  const [editContent, setEditContent] = useState(source.content);
  const [expanded, setExpanded] = useState(false);

  function handleSave() {
    onSaveEdit(source.id, editLabel, editContent);
    setEditing(false);
  }

  function handleCancelEdit() {
    setEditLabel(source.label);
    setEditContent(source.content);
    setEditing(false);
  }

  const isText = source.type === 'text';
  const isLong = source.content.length > 120;

  return (
    <div className="border border-outline-variant/30 rounded-xl bg-surface-container-lowest overflow-hidden transition-all hover:shadow-sm">
      {/* Header row */}
      <div className="flex items-start gap-3 p-4">
        {/* Type icon */}
        <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-outline shrink-0 mt-0.5">
          <Icon name={sourceIcon(source.type)} size="sm" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-3">
              <Input
                value={editLabel}
                onChange={e => setEditLabel(e.target.value)}
                placeholder="Label"
                className="text-[14px]"
              />
              {isText ? (
                <Textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  rows={5}
                  className="text-[13px]"
                />
              ) : (
                <Input
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  placeholder={source.type === 'url' ? 'https://…' : 'filename.pdf'}
                />
              )}
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave}>
                  <Icon name="save" size="sm" />
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={handleCancelEdit}>Cancel</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <p className="text-[14px] font-medium text-on-surface">{source.label}</p>
                <span className="text-[10px] uppercase font-bold text-outline bg-surface-container px-1.5 py-0.5 rounded tracking-wider">
                  {source.type}
                </span>
              </div>

              {/* Content preview */}
              {source.type === 'url' ? (
                <p className="text-[12px] text-primary truncate">{source.content}</p>
              ) : source.type === 'pdf' ? (
                <p className="text-[12px] text-on-surface-variant">{source.content}</p>
              ) : (
                <div>
                  <p className={`text-[12px] text-on-surface-variant ${!expanded && isLong ? 'line-clamp-2' : ''}`}>
                    {source.content}
                  </p>
                  {isLong && (
                    <button
                      onClick={() => setExpanded(e => !e)}
                      className="text-[11px] text-primary mt-1 hover:underline"
                    >
                      {expanded ? 'Show less' : 'Show more'}
                    </button>
                  )}
                </div>
              )}

              {/* Timestamps */}
              <div className="flex items-center gap-3 mt-2">
                <span className="text-[11px] text-outline">Added {formatDate(source.createdAt)}</span>
                {source.updatedAt && (
                  <span className="text-[11px] text-outline">· Edited {formatDate(source.updatedAt)}</span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        {!editing && (
          <div className="flex items-center gap-1 shrink-0">
            {isText && (
              <button
                onClick={() => setEditing(true)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors"
                title="Edit source"
              >
                <Icon name="edit" size="sm" />
              </button>
            )}
            <button
              onClick={() => onDelete(source.id)}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-error-container hover:text-error transition-colors"
              title="Delete source"
            >
              <Icon name="delete" size="sm" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── SourcesPanel (exported) ───────────────────────────────

interface SourcesPanelProps {
  caseId: string;
}

export function SourcesPanel({ caseId }: SourcesPanelProps) {
  const caseItem    = useContentCasesStore(s => s.getCaseById(caseId));
  const addSource   = useContentCasesStore(s => s.addSource);
  const updateSource = useContentCasesStore(s => s.updateSource);
  const deleteSource = useContentCasesStore(s => s.deleteSource);
  const [showForm, setShowForm] = useState(false);

  if (!caseItem) return null;

  // Show most recently added sources first
  const sources = [...caseItem.sources].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  function handleAdd(type: SourceType, label: string, content: string) {
    addSource(caseId, { type, label, content });
    setShowForm(false);
  }

  function handleSaveEdit(sourceId: string, label: string, content: string) {
    updateSource(caseId, sourceId, { label, content });
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm relative overflow-hidden">
      {/* Accent bar */}
      <div className="absolute top-0 left-0 w-1 h-full bg-primary" />

      <div className="pl-5 pr-5 pt-5 pb-5">
        {/* Panel header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[18px] font-serif font-medium text-on-surface flex items-center gap-2">
              <Icon name="article" className="text-outline" size="sm" />
              Content Sources
              <span className="text-[13px] font-sans font-normal text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full ml-1">
                {sources.length}
              </span>
            </h3>
            <p className="text-[12px] text-on-surface-variant mt-0.5">
              Add sources at any time — they'll be included in the next generation run.
            </p>
          </div>
          {!showForm && (
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Icon name="add" size="sm" />
              Add Source
            </Button>
          )}
        </div>

        {/* Add form */}
        {showForm && (
          <div className="mb-4">
            <AddSourceForm
              onAdd={handleAdd}
              onCancel={() => setShowForm(false)}
            />
          </div>
        )}

        {/* Source list */}
        {sources.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center mb-3">
              <Icon name="add_notes" size="lg" className="text-outline" />
            </div>
            <p className="text-[14px] font-medium text-on-surface-variant">No sources yet</p>
            <p className="text-[13px] text-outline mt-1 max-w-xs">
              Add text notes, URLs, or PDFs — the AI uses all sources in this workspace when generating content.
            </p>
            {!showForm && (
              <Button size="sm" className="mt-4" onClick={() => setShowForm(true)}>
                <Icon name="add" size="sm" />
                Add First Source
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {sources.map(source => (
              <SourceRow
                key={source.id}
                source={source}
                caseId={caseId}
                onDelete={id => deleteSource(caseId, id)}
                onSaveEdit={handleSaveEdit}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
