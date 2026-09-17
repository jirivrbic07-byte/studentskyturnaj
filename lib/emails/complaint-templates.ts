import { ea, emailShell, escapeHtml } from "@/lib/emails/email-shell";

export function complaintAdminEmailHtml(input: {
  senderEmail: string;
  senderName: string;
  roleLabel: string;
  teamName?: string;
  subject: string;
  message: string;
}): string {
  const safeMsg = escapeHtml(input.message).replace(/\n/g, "<br/>");
  return emailShell(
    "Nová stížnost z portálu",
    `<p style="${ea.p}">Kapitán nebo hráč poslal stížnost. Odpověz mu prosím co nejdřív přímo na jeho e-mail.</p>
<ul style="${ea.list}">
<li><strong style="${ea.strong}">Od:</strong> ${escapeHtml(input.senderEmail)}${
      input.senderName ? ` (${escapeHtml(input.senderName)})` : ""
    }</li>
<li><strong style="${ea.strong}">Účet:</strong> ${escapeHtml(input.roleLabel)}</li>
${
  input.teamName
    ? `<li><strong style="${ea.strong}">Tým:</strong> ${escapeHtml(input.teamName)}</li>`
    : ""
}
<li><strong style="${ea.strong}">Předmět:</strong> ${escapeHtml(input.subject)}</li>
</ul>
<div class="ea-box" style="${ea.box}">${safeMsg}</div>
<p style="${ea.muted}">Na tenhle e-mail můžeš odpovědět — zpráva půjde odesílateli.</p>`,
    { headerSub: "Stížnost · administrace" }
  );
}

export function complaintConfirmationEmailHtml(input: {
  senderName: string;
  subject: string;
  message: string;
}): string {
  const hello = input.senderName ? `Ahoj ${escapeHtml(input.senderName)},` : "Ahoj,";
  const safeMsg = escapeHtml(input.message).replace(/\n/g, "<br/>");
  return emailShell(
    "Stížnost jsme přijali",
    `<p style="${ea.p}">${hello}</p>
<p style="${ea.p}">potvrzujeme, že tvoje stížnost <strong style="${ea.strong}">${escapeHtml(input.subject)}</strong> byla odeslána všem administrátorům ESPORTARENA TSV.</p>
<p style="${ea.p}">Ozveme se ti co nejdřív se zpětnou vazbou na e-mail, ze kterého máš účet.</p>
<p style="${ea.muted}">Kopie tvé zprávy:</p>
<div class="ea-box" style="${ea.box}">${safeMsg}</div>
<p style="${ea.muted}">Na tenhle e-mail neodpovídej — jakmile se k tomu někdo z organizátorů dostane, napíše ti znovu.</p>`,
    { headerSub: "Stížnost · ESPORTARENA TSV" }
  );
}
