"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { useAdminTempBypass } from "@/contexts/admin-temp-context";
import { gameLabel, type GameId } from "@/lib/games";
import { PortalPageHeader } from "@/components/portal-page-header";
import { GlassCard } from "@/components/glass-card";
import { GlowButton } from "@/components/glow-button";
import { SeasonBracketView } from "@/components/season/season-bracket-view";
import type {
  QualificationAdvancement,
  SeasonBracketDocument,
  SeasonDocument,
} from "@/lib/seasons";
import { S4_SEASON_ID, disciplineForGame } from "@/lib/seasons";
import { resolveSeasonBracketForDisplay } from "@/lib/season-bracket";

type TournamentRow = {
  id: string;
  name: string;
  gameId: GameId;
  qualificationRound?: number | null;
  seasonId?: string;
};

type RegRow = {
  teamId: string;
  teamName: string;
  schoolName: string;
};

function QualResultPicker({
  tournament,
  getToken,
  onSaved,
}: {
  tournament: TournamentRow;
  getToken: () => Promise<string>;
  onSaved: () => void;
}) {
  const [teams, setTeams] = useState<RegRow[]>([]);
  const [places, setPlaces] = useState<Record<number, string>>({
    1: "",
    2: "",
    3: "",
    4: "",
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const token = await getToken();
        const res = await fetch(
          `/api/admin/seasons/s4/qualification-results?tournamentId=${encodeURIComponent(tournament.id)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const j = (await res.json()) as {
          teams?: RegRow[];
          registrations?: RegRow[];
          placements?: { placement: number; teamId: string }[];
          error?: string;
        };
        if (!res.ok) throw new Error(j.error ?? "Nelze načíst týmy");
        if (cancelled) return;
        const list = (j.teams?.length ? j.teams : j.registrations) ?? [];
        setTeams(list);
        const next: Record<number, string> = { 1: "", 2: "", 3: "", 4: "" };
        for (const p of j.placements ?? []) {
          if (p.placement >= 1 && p.placement <= 4) next[p.placement] = p.teamId;
        }
        setPlaces(next);
      } catch {
        if (!cancelled) setTeams([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tournament.id, getToken]);

  function setPlace(placement: number, teamId: string) {
    setPlaces((prev) => {
      const next = { ...prev };
      for (const n of [1, 2, 3, 4]) {
        if (n !== placement && next[n] === teamId) next[n] = "";
      }
      next[placement] = teamId;
      return next;
    });
  }

  async function save() {
    const advances = [1, 2, 3, 4].map((placement) => ({
      placement,
      teamId: places[placement] ?? "",
    }));
    setBusy(true);
    setMsg(null);
    try {
      const token = await getToken();
      const res = await fetch(
        `/api/admin/seasons/${S4_SEASON_ID}/qualification-results`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            tournamentId: tournament.id,
            advances,
            autoBracket: true,
            gameId: tournament.gameId,
          }),
        }
      );
      const j = (await res.json()) as { error?: string; saved?: unknown[] };
      if (!res.ok) {
        setMsg(j.error ?? "Uložení selhalo.");
        return;
      }
      setMsg(`Uloženo ${j.saved?.length ?? 0} umístění a doplněno do pavouka.`);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Načítám týmy…</p>;
  }

  return (
    <div className="mt-3 space-y-2">
      <ul className="space-y-2">
        {[1, 2, 3, 4].map((n) => (
          <li
            key={n}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm"
          >
            <span className="font-semibold text-white">{n}. místo</span>
            <select
              value={places[n] ?? ""}
              onChange={(e) => setPlace(n, e.target.value)}
              className="min-w-[240px] flex-1 rounded border border-white/10 bg-black/50 px-2 py-1 text-sm text-white"
            >
              <option value="">— vyber tým —</option>
              {teams.map((t) => (
                <option key={t.teamId} value={t.teamId}>
                  {t.teamName}
                  {t.schoolName ? ` · ${t.schoolName}` : ""}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      {teams.length === 0 ? (
        <p className="text-sm text-slate-500">
          Zatím tu nejsou schválené týmy v této hře. Až budou, objeví se v nabídce.
        </p>
      ) : null}
      {msg ? <p className="text-sm text-slate-400">{msg}</p> : null}
      <GlowButton type="button" disabled={busy} onClick={() => void save()}>
        {busy ? "Ukládám…" : "Uložit do pavouka"}
      </GlowButton>
    </div>
  );
}

export default function AdminSezonyPage() {
  const { user, loading, access } = useAuth();
  const tempBypass = useAdminTempBypass();
  const router = useRouter();
  const [season, setSeason] = useState<SeasonDocument | null>(null);
  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
  const [brackets, setBrackets] = useState<Record<string, SeasonBracketDocument | null>>({});
  const [advancements, setAdvancements] = useState<
    Record<string, QualificationAdvancement[]>
  >({});
  const [err, setErr] = useState<string | null>(null);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);
  const [seedBusy, setSeedBusy] = useState(false);
  const [tab, setTab] = useState<GameId>("cs2");
  const [reload, setReload] = useState(0);

  const getToken = useCallback(() => {
    if (!user) throw new Error("Nepřihlášen");
    return user.getIdToken();
  }, [user]);

  const load = useCallback(async () => {
    if (!user && !tempBypass) return;
    setErr(null);
    try {
      const token = user ? await user.getIdToken() : "";
      const res = await fetch(
        `/api/admin/seasons/${S4_SEASON_ID}/qualification-results?gameId=${tab}`,
        token ? { headers: { Authorization: `Bearer ${token}` } } : {}
      );
      const j = (await res.json()) as {
        season?: SeasonDocument;
        bracket?: SeasonBracketDocument | null;
        advancements?: QualificationAdvancement[];
        error?: string;
      };
      if (!res.ok) {
        setErr(j.error ?? "Nelze načíst sezónu");
        return;
      }
      setSeason(j.season ?? null);
      if (j.bracket) setBrackets((prev) => ({ ...prev, [tab]: j.bracket ?? null }));
      if (j.advancements) {
        setAdvancements((prev) => ({ ...prev, [tab]: j.advancements ?? [] }));
      }

      if (user) {
        const tRes = await fetch("/api/admin/tournaments", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const tj = (await tRes.json()) as { tournaments?: TournamentRow[] };
        if (tRes.ok) {
          setTournaments(
            (tj.tournaments ?? []).filter((t) => t.seasonId === S4_SEASON_ID)
          );
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Chyba načítání");
    }
  }, [user, tempBypass, tab, reload]);

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
  }, [user, loading, access.loading, access.isAdmin, load, router, tempBypass]);

  const displayBracket = season
    ? resolveSeasonBracketForDisplay({
        stored: brackets[tab] ?? null,
        gameId: tab,
        discipline: disciplineForGame(season, tab),
        advancements: advancements[tab] ?? [],
      })
    : null;

  async function seedS4() {
    if (!user) return;
    setSeedBusy(true);
    setSeedMsg(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/seasons/${S4_SEASON_ID}/seed`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = (await res.json()) as {
        error?: string;
        tournamentsCreated?: { name: string }[];
        bracketsInitialized?: string[];
      };
      if (!res.ok) {
        setSeedMsg(j.error ?? "Seed selhal.");
        return;
      }
      const n = j.tournamentsCreated?.length ?? 0;
      setSeedMsg(
        n > 0
          ? `Vytvořeno ${n} kvalifikačních turnajů. Pavouky: ${(j.bracketsInitialized ?? []).join(", ")}.`
          : "Sezóna S4 je připravená (kvalifikace už existují)."
      );
      setReload((x) => x + 1);
    } finally {
      setSeedBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
        Načítání…
      </div>
    );
  }

  const qualTournaments = tournaments
    .filter((t) => t.gameId === tab && t.qualificationRound)
    .sort((a, b) => (a.qualificationRound ?? 0) - (b.qualificationRound ?? 0));

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <PortalPageHeader
        title="Sezóny"
        backHref="/admin"
        backLabel="Administrace"
      />
      <p className="mt-2 text-sm text-slate-400">
        Správa Sezóny 4 — inicializace kvalifikací, výběr postupujících a pavouk.
        Veřejná stránka:{" "}
        <Link href="/sezona-4" className="text-[#39FF14] hover:underline">
          /sezona-4
        </Link>
      </p>

      {err ? (
        <p className="mt-6 text-sm text-red-400" role="alert">
          {err}
        </p>
      ) : null}

      <GlassCard className="mt-8">
        <h2 className="font-[family-name:var(--font-bebas)] text-2xl text-white">
          {season?.label ?? "Sezóna 4"}
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Inicializace založí chybějící kvalifikační turnaje (CS2 + LoL × 4) a prázdné
          pavouky, pokud ještě neexistují. Opakované spuštění už hotové turnaje ani
          vyplněný pavouk nepřepíše.
        </p>
        {seedMsg ? <p className="mt-3 text-sm text-[#39FF14]">{seedMsg}</p> : null}
        <GlowButton
          type="button"
          className="mt-4"
          disabled={seedBusy || !user}
          onClick={() => void seedS4()}
        >
          {seedBusy ? "Inicializuji…" : "Inicializovat Sezónu 4"}
        </GlowButton>
      </GlassCard>

      <div className="mt-8 flex flex-wrap gap-2">
        {(["cs2", "lol"] as const).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setTab(g)}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              tab === g
                ? "bg-[#39FF14] text-black"
                : "border border-white/15 text-slate-400 hover:text-white"
            }`}
          >
            {gameLabel(g)}
          </button>
        ))}
      </div>

      <GlassCard className="mt-6">
        <h2 className="font-[family-name:var(--font-bebas)] text-2xl text-white">
          Kvalifikace · {gameLabel(tab)}
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          U každé kvalifikace vyber 1. až 4. místo z nabídky týmů. Uložením se týmy
          hned zapíšou do pavouka podle schématu A–D.
        </p>
        {qualTournaments.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            Žádné kvalifikační turnaje — nejdřív spusť inicializaci S4.
          </p>
        ) : (
          <div className="mt-6 space-y-8">
            {qualTournaments.map((t) => (
              <div key={t.id} className="border-t border-white/10 pt-6 first:border-0 first:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold text-white">{t.name}</h3>
                  <Link
                    href={`/turnaje/${t.id}`}
                    className="text-xs text-[#39FF14] hover:underline"
                  >
                    Detail turnaje →
                  </Link>
                </div>
                {user ? (
                  <QualResultPicker
                    tournament={t}
                    getToken={getToken}
                    onSaved={() => setReload((x) => x + 1)}
                  />
                ) : (
                  <p className="mt-2 text-sm text-slate-500">
                    Pro uložení výsledků se přihlas jako admin.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <GlassCard className="mt-6">
        <h2 className="font-[family-name:var(--font-bebas)] text-2xl text-white">
          Pavouk · {gameLabel(tab)}
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Zobrazení jako na veřejné stránce. Ruční úpravy pavouku lze doplnit později přes API.
        </p>
        <div className="mt-6">
          {displayBracket ? <SeasonBracketView bracket={displayBracket} /> : null}
        </div>
        {(advancements[tab] ?? []).length > 0 ? (
          <p className="mt-4 text-xs text-slate-600">
            Postupujících v databázi: {(advancements[tab] ?? []).length}
          </p>
        ) : null}
      </GlassCard>
    </main>
  );
}
