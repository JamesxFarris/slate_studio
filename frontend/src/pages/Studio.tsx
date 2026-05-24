import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Sparkles } from 'lucide-react';
import { runsApi, ApiError, type CreateRunRequest } from '../lib/api';
import { useRunStore } from '../store/run';
import { useAgentRun } from '../hooks/useAgentRun';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { Label } from '../components/ui/Label';
import { Select } from '../components/ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { CompanyResearcherPanel } from '../components/agents/CompanyResearcherPanel';

// Studio page: JD submit form + live agent dashboard.
//
// Week 1 scope: only the Company Researcher panel is wired up. The other six
// panels will land in subsequent phases. Layout already uses a 3-column grid
// (per SPECIFICATION.md → dashboard UI) so adding panels is a drop-in.
export default function StudioPage(): JSX.Element {
  const currentRunId = useRunStore((s) => s.currentRunId);
  const setCurrentRunId = useRunStore((s) => s.setCurrentRunId);

  const [jdText, setJdText] = useState('');
  const [jdUrl, setJdUrl] = useState('');
  const [mode, setMode] = useState<CreateRunRequest['mode']>('standard');

  const { events, connected } = useAgentRun(currentRunId);

  const createRun = useMutation({
    mutationFn: () =>
      runsApi.create({
        jdText,
        jdUrl: jdUrl.trim() || undefined,
        mode,
      }),
    onSuccess: (data) => {
      setCurrentRunId(data.runId);
    },
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (jdText.trim().length === 0) return;
    createRun.mutate();
  };

  const submitErrorMessage =
    createRun.error instanceof ApiError
      ? createRun.error.message
      : createRun.error
      ? 'Unable to start run.'
      : null;

  return (
    <div className="min-h-screen">
      {/* Top bar — keeps the technical / terminal vibe. */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-studio-400" />
            <span className="font-semibold tracking-tight">Slate Studio</span>
            <span className="ml-3 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              week-1 skeleton
            </span>
          </div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
            {currentRunId ? (
              <>
                <span className="text-zinc-400">run</span>{' '}
                <span className="text-studio-400">{currentRunId.slice(0, 8)}</span>{' '}
                <span className={connected ? 'text-emerald-400' : 'text-zinc-600'}>
                  {connected ? '● live' : '○ offline'}
                </span>
              </>
            ) : (
              'no active run'
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Submit a job posting</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="jdText">Job description</Label>
                <Textarea
                  id="jdText"
                  required
                  placeholder="Paste the full job description here…"
                  value={jdText}
                  onChange={(e) => setJdText(e.target.value)}
                  rows={8}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-1.5">
                  <Label htmlFor="jdUrl">JD URL (optional)</Label>
                  <Input
                    id="jdUrl"
                    type="url"
                    placeholder="https://example.com/jobs/123"
                    value={jdUrl}
                    onChange={(e) => setJdUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mode">Mode</Label>
                  <Select
                    id="mode"
                    value={mode}
                    onChange={(e) => setMode(e.target.value as CreateRunRequest['mode'])}
                  >
                    <option value="standard">Standard</option>
                    <option value="deep">Deep</option>
                  </Select>
                </div>
              </div>

              {submitErrorMessage && (
                <div className="rounded-md border border-red-800 bg-red-950/50 px-3 py-2 text-xs text-red-300">
                  {submitErrorMessage}
                </div>
              )}

              <div className="flex justify-end">
                <Button type="submit" disabled={createRun.isPending || jdText.trim().length === 0}>
                  {createRun.isPending ? 'Starting run…' : 'Run agents'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* 3-column grid per SPECIFICATION.md. Only one panel populated in week 1. */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight text-zinc-200">Agents</h2>
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              {events.length} event{events.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <CompanyResearcherPanel events={events} />
            {/* Placeholders for the remaining 6 agents land in subsequent phases. */}
          </div>
        </section>
      </main>
    </div>
  );
}
