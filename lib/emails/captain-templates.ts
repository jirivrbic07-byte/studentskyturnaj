import { ea, emailShell, escapeHtml } from "@/lib/emails/email-shell";
import { SITE_COPY } from "@/lib/site-copy";

const emailSub = SITE_COPY.emailHeaderSub;
const announceMuted = SITE_COPY.announcementsPrimary;

export function welcomeEmailHtml(captainName: string) {
  return emailShell(
    "Vítej, kapitáne",
    `<p style="${ea.p}">Ahoj ${captainName},</p>
<p style="${ea.p}">tvůj účet kapitána byl vytvořen. Dokonči prosím profil a registraci týmu v portálu.</p>
<p style="${ea.muted}">${announceMuted} ${SITE_COPY.noWhatsApp}</p>`,
    { headerSub: emailSub }
  );
}

export function profileUpdateEmailHtml() {
  return emailShell(
    "Profil byl aktualizován",
    `<p style="${ea.p}">Tvé údaje kapitána byly uloženy.</p>
<p style="${ea.muted}">Změny můžeš kdykoli upravit po přihlášení. ${SITE_COPY.announcementsShort}</p>`,
    { headerSub: emailSub }
  );
}

export function teamSubmittedEmailHtml(
  teamName: string,
  schoolName: string,
  gameLabel?: string
) {
  const gameLine = gameLabel
    ? `<p style="${ea.p}"><strong style="${ea.strong}">Hra:</strong> ${gameLabel}</p>`
    : "";
  const afterApprove =
    gameLabel?.includes("Counter-Strike")
      ? "Po schválení administrátorem ti může být doplněn odkaz na Faceit kvalifikaci (u CS2) — v Oznámeních na webu."
      : "Po schválení administrátorem uvidíš další kroky v Oznámeních na webu.";
  return emailShell(
    "Tým odeslán ke schválení",
    `${gameLine}<p style="${ea.p}">Registrace týmu <strong style="${ea.strongGreen}">${teamName}</strong> (${schoolName}) byla přijata.</p>
<p style="${ea.p}">Status: <strong style="${ea.strong}">Čeká na schválení</strong>. ${afterApprove}</p>
<p style="${ea.muted}">Dotazy můžeš poslat přes Centrum podpory na webu.</p>`,
    { headerSub: emailSub }
  );
}

export function adminNewUserEmailHtml(email: string, uid: string, roleLabel = "kapitán") {
  return emailShell(
    `Nový účet · ${escapeHtml(roleLabel)}`,
    `<p style="${ea.p}">Byl zaregistrován nový účet (${escapeHtml(roleLabel)}).</p>
<ul style="${ea.list}"><li>E-mail: ${escapeHtml(email)}</li><li>UID: ${escapeHtml(uid)}</li></ul>`,
    { headerSub: emailSub }
  );
}

/** E-mail po naplánování smazání účtu (24 h odklad + odkaz na obnovení). */
export function accountDeletionScheduledEmailHtml(
  restoreUrl: string,
  expiresLabel: string
) {
  const safeUrl = escapeHtml(restoreUrl);
  const safeExp = escapeHtml(expiresLabel);
  return emailShell(
    "Účet bude smazán do 24 hodin",
    `<p style="${ea.p}">Požádal jsi o smazání kapitánského účtu včetně týmů. Údaje se <strong style="${ea.strong}">definitivně smažou nejdříve po uplynutí 24 hodin</strong>, pokud akci nezrušíš.</p>
<p style="${ea.p}">Lhůta končí: <strong style="${ea.strong}">${safeExp}</strong> (čas serveru webu).</p>
<p style="margin:24px 0;">
<a href="${safeUrl}" class="ea-btn" style="${ea.btn}">Obnovit účet</a>
</p>
<p style="${ea.muted}">Pokud jsi o smazání nežádal, odkaz použij také — účet zůstane zachovaný. Odkaz je jednorázový; po obnovení můžeš znovu normálně používat portál.</p>
<p style="${ea.muted}">Pokud tlačítko nefunguje, zkopíruj adresu do prohlížeče:<br/>${safeUrl}</p>`,
    { headerSub: emailSub }
  );
}
