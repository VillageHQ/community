// The digest's plain text, shown the way a mail app shows it (Founderhall's mailTextHtml): each "Label: <link>" line
// becomes a button, inert in a preview, so no raw address is printed on the page.
const LABELLED_LINK = /^(\s*)(.*?):\s+(https?:\/\/\S+)\s*$/u;
const TRAILING_LINK = /^(.*?)\s(https?:\/\/\S+)\s*$/u;

function InertButton({ label }: { label: string }) {
  return (
    <span className="fh-btn fh-btn-secondary fh-btn-sm fh-mbtn" role="img" aria-label={`${label} (button)`}>
      {label}
    </span>
  );
}

function MailLine({ line }: { line: string }) {
  const labelled = line.match(LABELLED_LINK);
  if (labelled) {
    const [, indent = "", label = ""] = labelled;
    const cut = label.lastIndexOf(". ");
    const before = cut >= 0 ? `${label.slice(0, cut + 1)} ` : "";
    return (
      <div className="fh-ml">
        {indent}
        {before}
        <InertButton label={cut >= 0 ? label.slice(cut + 2) : label} />
      </div>
    );
  }
  const trailing = line.match(TRAILING_LINK);
  if (trailing) {
    return (
      <div className="fh-ml">
        {trailing[1]} <InertButton label="Open" />
      </div>
    );
  }
  return <div className="fh-ml">{line || " "}</div>;
}

export function DigestMailText({ text }: { text: string }) {
  return (
    <div className="fh-mailtext fh-rendered">
      {text.split(/\r?\n/u).map((line, index) => (
        <MailLine key={index} line={line} />
      ))}
    </div>
  );
}
