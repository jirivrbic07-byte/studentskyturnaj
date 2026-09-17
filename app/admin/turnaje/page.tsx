"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { PortalPageHeader } from "@/components/portal-page-header";
import { useAdminTempBypass } from "@/contexts/admin-temp-context";
import { GAMES, type GameId } from "@/lib/games";
import {
  parseTournamentPhase,
  TOURNAMENT_PHASES,
  type TournamentPhase,
} from "@/lib/tournaments";
import {
  S4_SEASON_ID,
  TOURNAMENT_ACCESS_MODES,
  type TournamentAccessMode,
} from "@/lib/seasons";
import { GlassCard } from "@/components/glass-card";
import { GlowButton } from "@/components/glow-button";

type TeamPick = { id: string; teamName: string; schoolName: string };

type Row = {
  id: string;
  name: string;
  gameId: GameId;
  phase: TournamentPhase;
  backgroundImageUrl: string;
  startsAtMs?: number | null;
  prizePoolText: string;
  rulesText: string;
  faceitUrl: string;
  published: boolean;
  invitedTeamIds?: string[];
  seasonId?: string;
  accessMode?: TournamentAccessMode;
  qualificationRound?: number | null;
};

function PlayoffTeamPicker({
  gameId,
  selectedIds,
  onChange,
  getToken,
}: {
  gameId: GameId;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  getToken: () => Promise<string>;
}) {
  const [teams, setTeams] = useState<TeamPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadErr(null);
      try {
        const token = await getToken();
        const res = await fetch(
          `/api/admin/teams?scope=all&status=approved&gameId=${encodeURIComponent(gameId)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const j = (await res.json()) as {
          teams?: Array<{ id: string; teamName?: string; schoolName?: string }>;
          error?: string;
        };
        if (!res.ok) throw new Error(j.error ?? "Nelze načíst týmy");
        if (cancelled) return;
        setTeams(
          (j.teams ?? []).map((t) => ({
            id: t.id,
            teamName: String(t.teamName ?? ""),
            schoolName: String(t.schoolName ?? ""),
          }))
        );
      } catch (e) {
        if (!cancelled) {
          setLoadErr(e instanceof Error ? e.message : "Chyba načítání týmů");
          setTeams([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId, getToken]);

  function toggle(id: string) {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
    );
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Načítám schválené týmy…</p>;
  }
  if (loadErr) {
    return <p className="text-sm text-red-400">{loadErr}</p>;
  }
  if (teams.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Pro tuto hru zatím není žádný schválený tým.
      </p>
    );
  }

  return (
    <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto rounded-lg border border-white/10 bg-black/30 p-3">
      {teams.map((t) => (
        <li key={t.id}>
          <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={selectedIds.includes(t.id)}
              onChange={() => toggle(t.id)}
              className="mt-1 shrink-0"
            />
            <span className="min-w-0 break-words">
              <strong className="text-white">{t.teamName}</strong>
              <span className="text-slate-500"> · {t.schoolName}</span>
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}

function TournamentEditor({
  mode,
  initial,
  getToken,
  onChanged,
}: {
  mode: "create" | "edit";
  initial: Row;
  getToken: () => Promise<string>;
  onChanged: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [gameId, setGameId] = useState<GameId>(initial.gameId);
  const [phase, setPhase] = useState<TournamentPhase>(
    parseTournamentPhase(initial.phase)
  );
  const [invitedTeamIds, setInvitedTeamIds] = useState<string[]>(
    initial.invitedTeamIds ?? []
  );
  const [backgroundImageUrl, setBackgroundImageUrl] = useState(initial.backgroundImageUrl);
  const [startsAt, setStartsAt] = useState(
    initial.startsAtMs ? new Date(initial.startsAtMs).toISOString().slice(0, 16) : ""
  );
  const [prizePoolText, setPrizePoolText] = useState(initial.prizePoolText);
  const [rulesText, setRulesText] = useState(initial.rulesText);
  const [faceitUrl, setFaceitUrl] = useState(initial.faceitUrl);
  const [published, setPublished] = useState(initial.published);
  const [seasonId, setSeasonId] = useState(initial.seasonId ?? "");
  const [accessMode, setAccessMode] = useState<TournamentAccessMode>(
    initial.accessMode ?? "public"
  );
  const [qualificationRound, setQualificationRound] = useState(
    initial.qualificationRound ? String(initial.qualificationRound) : ""
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    gameId?: string;
    startsAt?: string;
    faceitUrl?: string;
  }>({});

  useEffect(() => {
    setName(initial.name);
    setGameId(initial.gameId);
    setPhase(parseTournamentPhase(initial.phase));
    setInvitedTeamIds(initial.invitedTeamIds ?? []);
    setBackgroundImageUrl(initial.backgroundImageUrl);
    setStartsAt(initial.startsAtMs ? new Date(initial.startsAtMs).toISOString().slice(0, 16) : "");
    setPrizePoolText(initial.prizePoolText);
    setRulesText(initial.rulesText);
    setFaceitUrl(initial.faceitUrl);
    setPublished(initial.published);
    setSeasonId(initial.seasonId ?? "");
    setAccessMode(initial.accessMode ?? "public");
    setQualificationRound(
      initial.qualificationRound ? String(initial.qualificationRound) : ""
    );
  }, [initial]);

  useEffect(() => {
    if (mode !== "edit" || !initial.id || phase !== "playoff") return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`/api/admin/tournaments/${initial.id}/invitations`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const j = (await res.json()) as { invitedTeamIds?: string[] };
        if (res.ok && !cancelled && j.invitedTeamIds) {
          setInvitedTeamIds(j.invitedTeamIds);
        }
      } catch {
        /* ponech stávající výběr */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode, initial.id, phase, getToken]);

  async function save() {
    const nextErrors: {
      name?: string;
      gameId?: string;
      startsAt?: string;
      faceitUrl?: string;
    } = {};
    if (!name.trim()) nextErrors.name = "Vyplň název turnaje.";
    if (!gameId) nextErrors.gameId = "Vyber hru.";
    if (startsAt && Number.isNaN(Date.parse(startsAt))) {
      nextErrors.startsAt = "Neplatné datum startu.";
    }
    if (faceitUrl.trim()) {
      try {
        const parsed = new URL(faceitUrl.trim());
        if (!/^https?:$/.test(parsed.protocol)) {
          nextErrors.faceitUrl = "Faceit URL musí začínat http:// nebo https://";
        }
      } catch {
        nextErrors.faceitUrl = "Zadej platnou Faceit URL.";
      }
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setMsg("Oprav zvýrazněná pole formuláře.");
      return;
    }

    setBusy(true);
    setMsg(null);
    try {
      const token = await getToken();
      if (mode === "create") {
        const res = await fetch("/api/admin/tournaments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name,
            gameId,
            phase,
            backgroundImageUrl,
            startsAt,
            prizePoolText,
            rulesText,
            faceitUrl,
            published,
            invitedTeamIds: phase === "playoff" ? invitedTeamIds : [],
            seasonId: seasonId.trim() || undefined,
            accessMode,
            qualificationRound: qualificationRound ? Number(qualificationRound) : undefined,
          }),
        });
        const j = (await res.json().catch(() => ({}))) as {
          error?: string;
          inviteSummary?: { emailed: number; skipped: number };
        };
        if (!res.ok) {
          setMsg(j.error ?? "Uložení selhalo");
          return;
        }
        const inviteNote =
          j.inviteSummary && j.inviteSummary.emailed > 0
            ? ` Odesláno ${j.inviteSummary.emailed} e-mailů s pozvánkou.`
            : "";
        setMsg(`Turnaj vytvořen.${inviteNote}`);
        onChanged();
      } else {
        const res = await fetch(`/api/admin/tournaments/${initial.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name,
            gameId,
            phase,
            backgroundImageUrl,
            startsAt,
            prizePoolText,
            rulesText,
            faceitUrl,
            published,
            invitedTeamIds: phase === "playoff" ? invitedTeamIds : [],
            seasonId: seasonId.trim() || undefined,
            accessMode,
            qualificationRound: qualificationRound ? Number(qualificationRound) : undefined,
          }),
        });
        const j = (await res.json().catch(() => ({}))) as {
          error?: string;
          inviteSummary?: { emailed: number; skipped: number };
        };
        if (!res.ok) {
          setMsg(j.error ?? "Uložení selhalo");
          return;
        }
        const inviteNote =
          j.inviteSummary && j.inviteSummary.emailed > 0
            ? ` Odesláno ${j.inviteSummary.emailed} e-mailů s pozvánkou.`
            : "";
        setMsg(`Uloženo.${inviteNote}`);
        onChanged();
      }
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (mode !== "edit") return;
    if (!window.confirm("Opravdu smazat turnaj včetně přihlášených týmů?")) return;
    setBusy(true);
    setMsg(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/tournaments/${initial.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMsg(j.error ?? "Smazání selhalo");
        return;
      }
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm text-slate-400">Název turnaje</label>
        <input
          name="tournamentName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1"
          placeholder="např. Kvalifikace S4 — CS2"
          required
        />
        {fieldErrors.name ? (
          <p className="mt-1 text-xs text-red-400">{fieldErrors.name}</p>
        ) : null}
      </div>
      <div>
        <label className="text-sm text-slate-400">Hra</label>
        <select
          name="gameId"
          value={gameId}
          onChange={(e) => setGameId(e.target.value as GameId)}
          className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
          required
        >
          {GAMES.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </select>
        {fieldErrors.gameId ? (
          <p className="mt-1 text-xs text-red-400">{fieldErrors.gameId}</p>
        ) : null}
      </div>
      <div>
        <label className="text-sm text-slate-400">Typ turnaje</label>
        <select
          name="phase"
          value={phase}
          onChange={(e) => {
            const next = parseTournamentPhase(e.target.value);
            setPhase(next);
            if (next === "qualification") setInvitedTeamIds([]);
          }}
          className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
        >
          {TOURNAMENT_PHASES.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          {TOURNAMENT_PHASES.find((p) => p.id === phase)?.hint}
        </p>
      </div>
      <div>
        <label className="text-sm text-slate-400">Sezóna (ID, volitelné)</label>
        <input
          name="seasonId"
          value={seasonId}
          onChange={(e) => setSeasonId(e.target.value)}
          className="mt-1"
          placeholder="např. s4"
        />
        <p className="mt-1 text-xs text-slate-500">
          Propojení s konkrétní sezónou (Sezóna 4 = <code className="text-slate-400">s4</code>).
        </p>
      </div>
      <div>
        <label className="text-sm text-slate-400">Kdo se může přihlásit</label>
        <select
          name="accessMode"
          value={accessMode}
          onChange={(e) =>
            setAccessMode(e.target.value as TournamentAccessMode)
          }
          className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
        >
          {TOURNAMENT_ACCESS_MODES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          {TOURNAMENT_ACCESS_MODES.find((m) => m.id === accessMode)?.hint}
        </p>
      </div>
      {phase === "qualification" ? (
        <div>
          <label className="text-sm text-slate-400">Číslo kvalifikace (1–4)</label>
          <input
            name="qualificationRound"
            type="number"
            min={1}
            max={4}
            value={qualificationRound}
            onChange={(e) => setQualificationRound(e.target.value)}
            className="mt-1 w-24"
            placeholder="1"
          />
        </div>
      ) : null}
      {phase === "playoff" ? (
        <div>
          <label className="text-sm text-slate-400">
            Pozvané týmy ({invitedTeamIds.length})
          </label>
          <p className="mt-1 text-xs text-slate-500">
            Vyber schválené týmy pro danou hru. Po uložení dostanou kapitáni e-mail s
            výzvou k potvrzení účasti.
          </p>
          <PlayoffTeamPicker
            gameId={gameId}
            selectedIds={invitedTeamIds}
            onChange={setInvitedTeamIds}
            getToken={getToken}
          />
        </div>
      ) : null}
      <div>
        <label className="text-sm text-slate-400">URL obrázku pozadí (volitelné)</label>
        <input
          name="backgroundImageUrl"
          value={backgroundImageUrl}
          onChange={(e) => setBackgroundImageUrl(e.target.value)}
          className="mt-1"
          placeholder="https://…"
        />
      </div>
      <div>
        <label className="text-sm text-slate-400">Start turnaje (datum + čas)</label>
        <input
          type="datetime-local"
          name="startsAt"
          value={startsAt}
          onChange={(e) => setStartsAt(e.target.value)}
          className="mt-1"
        />
        {fieldErrors.startsAt ? (
          <p className="mt-1 text-xs text-red-400">{fieldErrors.startsAt}</p>
        ) : null}
      </div>
      <div>
        <label className="text-sm text-slate-400">Prize pool (text)</label>
        <input
          name="prizePoolText"
          value={prizePoolText}
          onChange={(e) => setPrizePoolText(e.target.value)}
          className="mt-1"
          placeholder="Nech prázdné = zatím neznámo (oznámíme během registrace)"
        />
      </div>
      <div>
        <label className="text-sm text-slate-400">Faceit URL</label>
        <input
          name="faceitUrl"
          value={faceitUrl}
          onChange={(e) => setFaceitUrl(e.target.value)}
          className="mt-1"
          placeholder="https://…"
        />
        {fieldErrors.faceitUrl ? (
          <p className="mt-1 text-xs text-red-400">{fieldErrors.faceitUrl}</p>
        ) : null}
      </div>
      <div>
        <label className="text-sm text-slate-400">Pravidla</label>
        <textarea
          name="rulesText"
          value={rulesText}
          onChange={(e) => setRulesText(e.target.value)}
          className="mt-1 min-h-[140px] font-mono text-xs"
          placeholder="Formát, mapy, termíny…"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          name="published"
          checked={published}
          onChange={(e) => setPublished(e.target.checked)}
        />
        Zveřejnit (viditelné na webu a pro kapitány)
      </label>
      {msg ? (
        <p className="text-sm text-slate-400" role="status">
          {msg}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <GlowButton type="button" disabled={busy} onClick={() => void save()}>
          {mode === "create" ? "Vytvořit turnaj" : "Uložit změny"}
        </GlowButton>
        {mode === "edit" ? (
          <GlowButton
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => void remove()}
          >
            Smazat
          </GlowButton>
        ) : null}
      </div>
    </div>
  );
}

const emptyRow = (): Row => ({
  id: "",
  name: "",
  gameId: "cs2",
  phase: "qualification",
  backgroundImageUrl: "",
  prizePoolText: "",
  rulesText: "",
  faceitUrl: "",
  published: false,
  invitedTeamIds: [],
  seasonId: S4_SEASON_ID,
  accessMode: "season_enrolled",
  qualificationRound: null,
});

export default function AdminTurnajePage() {
  const { user, loading, access } = useAuth();
  const tempBypass = useAdminTempBypass();
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loadTick, setLoadTick] = useState(0);

  const getToken = useCallback(() => {
    if (!user) throw new Error("Nepřihlášen");
    return user.getIdToken();
  }, [user]);

  const load = useCallback(async () => {
    if (!user) {
      if (tempBypass) {
        setErr(
          "Přihlas se administrátorským účtem (ADMIN_EMAILS / super admin), aby se turnaje načetly a šly upravovat."
        );
        setRows([]);
      }
      return;
    }
    setErr(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/tournaments", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = (await res.json()) as {
        ok?: boolean;
        tournaments?: Row[];
        error?: string;
      };
      if (res.status === 401 || res.status === 403) {
        if (tempBypass) {
          setErr(
            j.error ??
              "API odmítlo přístup — účet není v seznamu administrátorů."
          );
          setRows([]);
          return;
        }
        router.replace("/zakazano");
        return;
      }
      if (!res.ok) {
        setErr(j.error ?? "Nelze načíst turnaje");
        setRows([]);
        return;
      }
      setRows(
        (j.tournaments ?? []).map((t) => ({
          ...t,
          phase: parseTournamentPhase(t.phase),
          gameId: (t.gameId ?? "cs2") as GameId,
        }))
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Chyba sítě");
    }
  }, [user, router, tempBypass]);

  useEffect(() => {
    if (loading || access.loading) return;
    if (tempBypass) {
      void load();
      return;
    }
    if (!user) {
      router.replace("/prihlaseni");
      return;
    }
    if (!access.isAdmin) {
      router.replace("/zakazano");
      return;
    }
    void load();
  }, [user, loading, access.loading, access.isAdmin, load, router, loadTick, tempBypass]);

  if (loading || access.loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        Načítání…
      </div>
    );
  }

  if (!tempBypass && (!user || !access.isAdmin)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        Načítání…
      </div>
    );
  }

  const canUseApi = Boolean(user && access.isAdmin);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 md:py-12">
      <PortalPageHeader
        backHref="/admin"
        backLabel="Přehled administrace"
        title="Správa turnajů"
        description={
          <>
            Vytvořené turnaje se zobrazí kapitánům a na{" "}
            <Link href="/turnaje" className="text-[#39FF14] hover:underline">
              /turnaje
            </Link>
            , pokud jsou zveřejněné.
          </>
        }
      />

      {err ? (
        <p className="mt-6 text-sm text-red-400" role="alert">
          {err}
        </p>
      ) : null}

      {canUseApi ? (
        <>
          <GlassCard className="mt-8">
            <h2 className="font-[family-name:var(--font-bebas)] text-xl text-[#39FF14]">
              Nový turnaj
            </h2>
            <div className="mt-4">
              <TournamentEditor
                key={`new-${loadTick}`}
                mode="create"
                initial={emptyRow()}
                getToken={getToken}
                onChanged={() => setLoadTick((t) => t + 1)}
              />
            </div>
          </GlassCard>

          <h2 className="mt-12 font-[family-name:var(--font-bebas)] text-2xl text-white">
            Existující turnaje
          </h2>
          <div className="mt-6 space-y-6">
            {rows.length === 0 ? (
              <p className="text-sm text-slate-500">Zatím žádné záznamy.</p>
            ) : (
              rows.map((r) => (
                <GlassCard key={r.id}>
                  <p className="text-xs font-mono text-slate-600">ID: {r.id}</p>
                  <div className="mt-4">
                    <TournamentEditor
                      mode="edit"
                      initial={r}
                      getToken={getToken}
                      onChanged={() => setLoadTick((x) => x + 1)}
                    />
                  </div>
                </GlassCard>
              ))
            )}
          </div>
        </>
      ) : (
        <GlassCard className="mt-8">
          <p className="text-sm text-slate-300">
            Úpravy turnajů vyžadují přihlášení{" "}
            <strong className="text-white">administrátorským</strong> účtem (stejný
            e-mail jako v <code className="text-slate-500">ADMIN_EMAILS</code> na
            serveru a v <code className="text-slate-500">NEXT_PUBLIC_ADMIN_EMAILS</code>{" "}
            u buildu, případně super admin v{" "}
            <code className="text-slate-500">lib/super-admin.ts</code>).
          </p>
          <GlowButton href="/prihlaseni" className="mt-4 !justify-center">
            Přihlásit se
          </GlowButton>
        </GlassCard>
      )}
    </main>
  );
}
