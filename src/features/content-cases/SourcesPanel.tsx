import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { Input, Textarea } from '../../components/ui/Input';
import { useContentCasesStore } from '../../stores/contentCasesStore';
import type { ContentSource, SourceStatus, SourceType, SourceIntelligence } from '../../types';

// ── URL helpers (Phase A/B) ───────────────────────────────
// Social hosts whose posts often can't be auto-extracted (login/JS walls). Drives
// the pre-submit hint and the source-aware "paste post text" fallback wording.
const SOCIAL_HOST_RE = /(^|\.)(facebook\.com|fb\.com|linkedin\.com|x\.com|twitter\.com|instagram\.com|reddit\.com|youtube\.com|youtu\.be)$/i;
const HAS_SCHEME_RE = /^[a-z][a-z0-9+.-]*:\/\//i;

// Prepend https:// when the user omits a scheme, then validate shape. Returns the
// normalized absolute URL, or null when it still isn't a valid http(s) URL.
function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = HAS_SCHEME_RE.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!u.hostname.includes('.')) return null; // reject schemeless host with no dot/TLD
    return u.toString();
  } catch {
    return null;
  }
}

function isSocialUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  const withScheme = HAS_SCHEME_RE.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return SOCIAL_HOST_RE.test(new URL(withScheme).hostname);
  } catch {
    return false;
  }
}

// Source-aware wording for the manual-paste CTA (req. 7):
//   social post → "Paste post text manually"
//   generic page (partial extraction) → "Paste page text manually"
//   article / other → "Add article text manually"
function manualPasteLabel(source: ContentSource): string {
  if (source.type === 'url' && isSocialUrl(source.content)) return 'Paste post text manually';
  if (source.type === 'url' && source.extractionStatus === 'partial') return 'Paste page text manually';
  return 'Add article text manually';
}

// ── Source Intelligence section ──────────────────────────

function IntelligenceSection({ intel }: { intel: SourceIntelligence }) {
  const [open, setOpen] = useState(false);
  const sentimentColor = {
    positive: 'text-green-700', negative: 'text-error',
    neutral: 'text-on-surface-variant', mixed: 'text-outline',
  }[intel.sentiment];

  // Shape-tolerant reads — supports both new Phase 8 shape and legacy records.
  const topics     = intel.mainTopics ?? intel.topics ?? [];
  const confidence = intel.analysisConfidenceScore ?? intel.confidenceScore;
  const entities   = intel.entities ?? [];
  const claimTexts = (intel.claims ?? []).map(c => (typeof c === 'string' ? c : c.text));

  return (
    <div className="mt-2 border-t border-outline-variant/20 pt-2">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-[11px] text-primary font-medium hover:underline"
      >
        <Icon name={open ? 'expand_less' : 'expand_more'} size="sm" />
        Source Intelligence
        {confidence !== undefined && (
          <span className="text-outline font-normal">· {confidence}% confidence</span>
        )}
        {intel.analysisVersion?.startsWith('claude') && (
          <span className="text-[9px] bg-primary/10 text-primary px-1 py-0.5 rounded uppercase font-bold tracking-wide">AI</span>
        )}
      </button>
      {open && (
        <div className="mt-2 bg-surface-container-low rounded-lg p-3 space-y-2">
          <p className="text-[12px] text-on-surface">{intel.summary}</p>

          {topics.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-[10px] font-bold text-outline uppercase mr-1">Topics:</span>
              {topics.slice(0, 5).map(t => (
                <span key={t} className="text-[11px] bg-secondary-container/40 text-on-secondary-container px-1.5 py-0.5 rounded font-medium">{t}</span>
              ))}
            </div>
          )}

          {intel.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-[10px] font-bold text-outline uppercase mr-1">Keywords:</span>
              {intel.keywords.slice(0, 5).map(k => (
                <span key={k} className="text-[10px] bg-surface-container text-on-surface-variant px-1.5 py-0.5 rounded">{k}</span>
              ))}
            </div>
          )}

          {entities.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <span className="text-[10px] font-bold text-outline uppercase mr-1">Entities:</span>
              {entities.slice(0, 8).map(e => (
                <span key={e.name} className="text-[10px] bg-tertiary-fixed/40 text-on-tertiary-fixed px-1.5 py-0.5 rounded" title={e.type}>{e.name}</span>
              ))}
            </div>
          )}

          {claimTexts.length > 0 && (
            <div>
              <span className="text-[10px] font-bold text-outline uppercase">Claims:</span>
              <ul className="mt-1 space-y-0.5">
                {claimTexts.slice(0, 3).map((c, i) => (
                  <li key={i} className="text-[11px] text-on-surface-variant pl-3 relative before:content-['•'] before:absolute before:left-0">{c}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-4 flex-wrap">
            <p className={`text-[11px] font-medium ${sentimentColor}`}>
              Sentiment: {intel.sentiment}
            </p>
            {intel.importanceScore !== undefined && (
              <p className="text-[11px] text-on-surface-variant">
                Importance: <span className="font-bold text-on-surface">{intel.importanceScore}</span>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Source status badge ───────────────────────────────────

const statusConfig: Record<SourceStatus, { label: string; cls: string }> = {
  new:     { label: 'New',     cls: 'bg-green-100 text-green-700' },
  used:    { label: 'Used',    cls: 'bg-surface-container-high text-on-surface-variant' },
  ignored: { label: 'Ignored', cls: 'bg-surface-container text-outline' },
  error:   { label: 'Error',   cls: 'bg-error-container/60 text-error' },
};

function SourceStatusBadge({ status }: { status: SourceStatus }) {
  const cfg = statusConfig[status];
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// Content-extraction status line (Phase 8.5). Shown for url and pdf sources.
// Communicates whether readable content was extracted, or analysis fell back to
// the URL/filename only — never surfaces the raw technical error.
function ExtractionStatusLine({ source }: { source: ContentSource }) {
  const status = source.extractionStatus;
  const isPdf = source.type === 'pdf';

  if (status === 'success') {
    return (
      <p className="text-[11px] text-green-700 mt-1 flex items-center gap-1">
        <Icon name="check_circle" size="sm" />
        <span>Extracted successfully{source.extractedTitle ? <> — “<bdi>{source.extractedTitle}</bdi>”</> : ''}</span>
      </p>
    );
  }
  if (status === 'partial') {
    return (
      <p className="text-[11px] text-amber-700 mt-1 flex items-center gap-1">
        <Icon name="info" size="sm" />
        <span>
          Limited extraction{source.extractedTitle ? <> — “<bdi>{source.extractedTitle}</bdi>”</> : ''}.
          {' '}Analysis is based on the page preview — paste the full text for best results.
        </span>
      </p>
    );
  }
  if (status === 'failed') {
    return (
      <p className="text-[11px] text-amber-700 mt-1 flex items-center gap-1">
        <Icon name="info" size="sm" />
        {isPdf
          ? 'Couldn’t read this PDF automatically. Analysis is based on the filename only.'
          : 'Couldn’t read this page automatically. Analysis is based on the URL only.'}
      </p>
    );
  }
  if (status === 'skipped' || !status) {
    return (
      <p className="text-[11px] text-outline mt-1">
        {isPdf ? 'Analysis based on filename only.' : 'Analysis based on URL only.'}
      </p>
    );
  }
  return null;
}

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
  onAdd: (type: SourceType, label: string, content: string, fileData?: string) => Promise<void>;
  // Phase 11B — add several URL sources at once (concurrent batch). Returns the
  // count added and any per-source failures so the form can show partial results.
  onAddMany: (inputs: { type: SourceType; label: string; content: string }[]) => Promise<{ added: number; failed: { index: number; error: string }[] }>;
  onCancel: () => void;
}

// 10 MB — matches backend MAX_FILE_SIZE_BYTES. Larger PDFs are rejected here so
// we never ship an oversized base64 body the server would only reject anyway.
const MAX_PDF_BYTES = 10 * 1024 * 1024;

function AddSourceForm({ onAdd, onAddMany, onCancel }: AddFormProps) {
  const [type, setType]       = useState<SourceType>('text');
  const [label, setLabel]     = useState('');
  const [content, setContent] = useState('');
  const [fileData, setFileData] = useState<string | null>(null); // base64 PDF bytes
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Read a chosen PDF as base64 and capture its filename as the content.
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please choose a PDF file.');
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setError('This PDF is larger than 10 MB. Please choose a smaller file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      // dataURL is "data:application/pdf;base64,XXXX" — keep only the base64 part.
      const result = String(reader.result);
      const base64 = result.includes(',') ? result.slice(result.indexOf(',') + 1) : result;
      setFileData(base64);
      setContent(file.name);
    };
    reader.onerror = () => setError('Could not read the file. Please try again.');
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    if (!content.trim() || saving) return;
    if (type === 'pdf' && !fileData) {
      setError('Please choose a PDF file to upload.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Phase 11B — URL type accepts several URLs (one per line). 2+ → concurrent
      // batch; 0–1 → the existing single POST (behaviour unchanged). text/pdf are
      // always a single source.
      if (type === 'url') {
        const rawLines = content.split('\n').map(u => u.trim()).filter(Boolean);
        // Phase A — normalize (prepend https://) + validate shape. Block submit on
        // any invalid line so a bad URL is never sent to the server.
        const urls: string[] = [];
        const invalid: string[] = [];
        for (const line of rawLines) {
          const n = normalizeUrl(line);
          if (n) urls.push(n); else invalid.push(line);
        }
        if (invalid.length > 0) {
          setError(`These don’t look like valid URLs:\n` + invalid.map(u => `• ${u}`).join('\n'));
          setSaving(false);
          return;
        }
        if (urls.length === 0) {
          setError('Please enter at least one URL.');
          setSaving(false);
          return;
        }
        if (urls.length > 1) {
          const { added, failed } = await onAddMany(urls.map(u => ({ type: 'url', label, content: u })));
          if (failed.length === 0) return; // all added → parent closes the form
          // Partial success: keep the failed URLs in the box, report them, stay open.
          const failedUrls = failed.map(f => urls[f.index]).filter(Boolean);
          setContent(failedUrls.join('\n'));
          setError(`Added ${added} of ${urls.length}. Failed:\n` + failed.map(f => `• ${urls[f.index] ?? `#${f.index}`} — ${f.error}`).join('\n'));
          setSaving(false);
          return;
        }
        await onAdd('url', label, urls[0], undefined);
        return; // parent closes on success
      }
      await onAdd(type, label, content, type === 'pdf' ? fileData ?? undefined : undefined);
      // Form is closed by the parent on success
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add source. Please try again.');
      setSaving(false);
    }
  }

  return (
    <div className="bg-surface-container-low rounded-xl p-5 border border-primary/20 space-y-4">
      {/* Type selector */}
      <div className="flex gap-2">
        {SOURCE_TYPES.map(t => (
          <button
            key={t.value}
            type="button"
            onClick={() => { setType(t.value); setContent(''); setFileData(null); setError(null); }}
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
        <>
          <Textarea
            label="URL(s) *"
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="https://… — paste one URL per line to add several at once"
            rows={3}
          />
          {content.split('\n').some(l => isSocialUrl(l)) && (
            <div className="flex items-start gap-2 text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <Icon name="info" size="sm" className="shrink-0 mt-0.5" />
              <span>Social platforms often block automatic extraction. If extraction fails, paste the post text manually.</span>
            </div>
          )}
        </>
      )}
      {type === 'pdf' && (
        <div className="space-y-3">
          <label className="block border-2 border-dashed border-outline-variant rounded-lg p-6 text-center cursor-pointer hover:border-primary/40 transition-colors">
            <Icon name="upload_file" size="xl" className="text-outline mx-auto mb-2" />
            {content ? (
              <p className="text-[14px] text-on-surface font-medium mb-1">{content}</p>
            ) : (
              <p className="text-[14px] text-on-surface-variant mb-1">Choose a PDF to upload</p>
            )}
            <p className="text-[12px] text-outline">PDF only · up to 10 MB · text is extracted automatically</p>
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-2 text-[12px] text-error bg-error-container/50 rounded-lg px-3 py-2">
          <Icon name="error" size="sm" />
          <span className="whitespace-pre-line">{error}</span>
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={!content.trim() || saving} loading={saving}>
          <Icon name="add" size="sm" />
          {saving ? 'Saving…' : 'Add Source'}
        </Button>
      </div>
    </div>
  );
}

// ── Source row ────────────────────────────────────────────

interface SourceRowProps {
  source: ContentSource;
  onDelete:     (id: string) => Promise<void>;
  onSaveEdit:   (id: string, label: string, content: string) => Promise<void>;
  onManualText: (id: string, text: string) => Promise<void>;
}

function SourceRow({ source, onDelete, onSaveEdit, onManualText }: SourceRowProps) {
  const [editing, setEditing]         = useState(false);
  const [editLabel, setEditLabel]     = useState(source.label);
  const [editContent, setEditContent] = useState(source.content);
  const [expanded, setExpanded]       = useState(false);
  const [saving, setSaving]           = useState(false);
  const [deleting, setDeleting]       = useState(false);
  const [saveError, setSaveError]     = useState<string | null>(null);

  // Manual-text replacement (Phase 8.5) for a url/pdf whose extraction failed.
  const [pasting, setPasting]         = useState(false);
  const [manualText, setManualText]   = useState('');
  const [manualSaving, setManualSaving] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  const canAddManualText =
    (source.type === 'url' || source.type === 'pdf') &&
    (source.extractionStatus === 'failed' || source.extractionStatus === 'partial');

  async function handleSaveManualText() {
    if (!manualText.trim() || manualSaving) return;
    setManualSaving(true);
    setManualError(null);
    try {
      await onManualText(source.id, manualText.trim());
      setPasting(false);
      setManualText('');
    } catch (err) {
      setManualError(err instanceof Error ? err.message : 'Could not save. Please try again.');
    } finally {
      setManualSaving(false);
    }
  }

  // Keep local edit state in sync with store updates (e.g. after save roundtrip)
  // The key on this component resets on source id change; label/content sync on source prop change
  const isText = source.type === 'text';
  const isLong = source.content.length > 120;

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSaveEdit(source.id, editLabel, editContent);
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    setEditLabel(source.label);
    setEditContent(source.content);
    setSaveError(null);
    setEditing(false);
  }

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      await onDelete(source.id);
      // Component unmounts on success (parent removes it from list)
    } catch {
      // Source stays visible if delete fails — user can retry
      setDeleting(false);
    }
  }

  return (
    <div className={[
      'border border-outline-variant/30 rounded-xl bg-surface-container-lowest overflow-hidden transition-all hover:shadow-sm',
      deleting ? 'opacity-50' : '',
    ].join(' ')}>
      <div className="flex items-start gap-3 p-4">
        {/* Type icon */}
        <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-outline shrink-0 mt-0.5">
          <Icon name={sourceIcon(source.type)} size="sm" />
        </div>

        {/* Content area */}
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
              {saveError && (
                <div className="flex items-center gap-2 text-[12px] text-error bg-error-container/50 rounded-lg px-3 py-2">
                  <Icon name="error" size="sm" />
                  <span>{saveError}</span>
                </div>
              )}
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} loading={saving} disabled={saving}>
                  <Icon name="save" size="sm" />
                  {saving ? 'Saving…' : 'Save'}
                </Button>
                <Button size="sm" variant="ghost" onClick={handleCancelEdit} disabled={saving}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <p dir="auto" className={`text-[14px] font-medium ${source.status === 'used' ? 'text-on-surface-variant' : 'text-on-surface'}`}>
                  {source.label}
                </p>
                <span className="text-[10px] uppercase font-bold text-outline bg-surface-container px-1.5 py-0.5 rounded tracking-wider">
                  {source.type}
                </span>
                <SourceStatusBadge status={source.status} />
              </div>

              {source.type === 'url' ? (
                <>
                  <p className="text-[12px] text-primary truncate">{source.content}</p>
                  <ExtractionStatusLine source={source} />
                </>
              ) : source.type === 'pdf' ? (
                <>
                  <p className="text-[12px] text-on-surface-variant truncate">{source.content}</p>
                  <ExtractionStatusLine source={source} />
                </>
              ) : (
                <div>
                  <p dir="auto" className={`text-[12px] text-on-surface-variant ${!expanded && isLong ? 'line-clamp-2' : ''}`}>
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

              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="text-[11px] text-outline">Added {formatDate(source.createdAt)}</span>
                {source.updatedAt && (
                  <span className="text-[11px] text-outline">· Edited {formatDate(source.updatedAt)}</span>
                )}
                {source.lastUsedAt && (
                  <span className="text-[11px] text-outline">· Used {formatDate(source.lastUsedAt)}</span>
                )}
              </div>

              {/* Source Intelligence section — always shown; null = legacy source */}
              {source.sourceIntelligence ? (
                <IntelligenceSection intel={source.sourceIntelligence} />
              ) : (
                <p className="text-[11px] text-outline mt-2 italic">Analysis not available</p>
              )}

              {/* Manual text fallback — url/pdf whose extraction failed or was partial */}
              {canAddManualText && (
                <div className="mt-2">
                  {pasting ? (
                    <div className="space-y-2">
                      <Textarea
                        value={manualText}
                        onChange={e => setManualText(e.target.value)}
                        rows={5}
                        placeholder="Paste the post or page text here to analyze it directly…"
                        className="text-[13px]"
                      />
                      {manualError && (
                        <div className="flex items-center gap-2 text-[12px] text-error bg-error-container/50 rounded-lg px-3 py-2">
                          <Icon name="error" size="sm" />
                          <span>{manualError}</span>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveManualText} loading={manualSaving} disabled={manualSaving || !manualText.trim()}>
                          <Icon name="auto_awesome" size="sm" />
                          {manualSaving ? 'Analyzing…' : 'Analyze pasted text'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setPasting(false); setManualText(''); setManualError(null); }} disabled={manualSaving}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setPasting(true)}
                      className="text-[11px] text-primary hover:underline flex items-center gap-1"
                    >
                      <Icon name="content_paste" size="sm" />
                      {manualPasteLabel(source)}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Action buttons — hidden while editing */}
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
              onClick={handleDelete}
              disabled={deleting}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-error-container hover:text-error transition-colors disabled:opacity-40"
              title="Delete source"
            >
              {deleting
                ? <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
                : <Icon name="delete" size="sm" />
              }
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
  const caseItem     = useContentCasesStore(s => s.getCaseById(caseId));
  const addSource    = useContentCasesStore(s => s.addSource);
  const addSources   = useContentCasesStore(s => s.addSources);
  const updateSource = useContentCasesStore(s => s.updateSource);
  const deleteSource = useContentCasesStore(s => s.deleteSource);
  const [showForm, setShowForm] = useState(false);

  if (!caseItem) return null;

  // Most recently added first
  const sources = [...caseItem.sources].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  async function handleAdd(type: SourceType, label: string, content: string, fileData?: string) {
    await addSource(caseId, { type, label, content, fileData });
    setShowForm(false);
  }

  // Phase 11B — multiple sources in one action → concurrent batch endpoint.
  // Close the form only on full success; on partial failure the form stays open
  // and shows which sources failed (the successful ones are already in the list).
  async function handleAddMany(inputs: { type: SourceType; label: string; content: string }[]) {
    const { added, failed } = await addSources(caseId, inputs);
    if (failed.length === 0) setShowForm(false);
    return { added: added.length, failed };
  }

  async function handleSaveEdit(sourceId: string, label: string, content: string) {
    await updateSource(caseId, sourceId, { label, content });
  }

  // Phase 8.5: user pasted readable text for a url/pdf whose extraction failed.
  async function handleManualText(sourceId: string, text: string) {
    await updateSource(caseId, sourceId, { manualText: text });
  }

  async function handleDelete(id: string) {
    await deleteSource(caseId, id);
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm relative overflow-hidden">
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
              onAddMany={handleAddMany}
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
          <div className="space-y-2 max-h-[360px] md:max-h-[440px] overflow-y-auto pr-1 -mr-1">
            {sources.map(source => (
              <SourceRow
                key={source.id}
                source={source}
                onDelete={handleDelete}
                onSaveEdit={handleSaveEdit}
                onManualText={handleManualText}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
