import { readInviteWords } from "@/modules/members/contract-invite-email";

type InviteEmailPreviewProps = { community: string; from: string; inviterName: string; inviterRole: string | null };

// Founderhall's mail preview (crop mail-preview.png): the invite as it goes out, with a made-up founder's name.
export function InviteEmailPreview({ community, from, inviterName, inviterRole }: InviteEmailPreviewProps) {
  const words = readInviteWords({ community, inviteeName: "Ada Okafor", inviterName, inviterRole });
  return (
    <div className="fh-mail">
      <div className="fh-mail-h">
        <div>
          <span className="fh-k">From</span>
          <span className="fh-v">{from}</span>
        </div>
        <div>
          <span className="fh-k">To</span>
          <span className="fh-v">the person you invite</span>
        </div>
        <div className="fh-subj">{words.subject}</div>
      </div>
      <div className="fh-mail-b">
        <p>{words.hi}</p>
        <p>{words.lead}</p>
        <p>{words.how}.</p>
        <div className="fh-mbtns">
          <span className="fh-btn fh-btn-primary fh-btn-sm">{words.button}</span>
        </div>
        <p className="fh-small fh-muted">{words.small}</p>
        <p className="fh-sign">{words.sign}</p>
      </div>
      <div className="fh-mail-f fh-small fh-muted">{words.footer}</div>
    </div>
  );
}
