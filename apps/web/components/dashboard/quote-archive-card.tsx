type QuoteArchiveCardProps = {
  quotes: Array<{
    text: string;
    source: string;
  }>;
};

export function QuoteArchiveCard({ quotes }: QuoteArchiveCardProps) {
  const primaryQuotes = quotes.slice(0, 2);
  const secondaryQuotes = quotes.slice(2);

  return (
    <section className="glass-panel rounded-lg border border-white/12 p-5 sm:p-6">
      <div className="space-y-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/80">
            近期关键金句
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
            保留能推动判断的表达
          </h2>
        </div>

        <div className="space-y-3">
          {primaryQuotes.map((quote) => (
            <blockquote
              key={quote.text}
              className="rounded-lg border border-white/12 bg-white/50 px-4 py-4 dark:bg-white/5"
            >
              <p className="text-sm leading-7 text-foreground">“{quote.text}”</p>
              <footer className="mt-3 text-xs text-muted-foreground">{quote.source}</footer>
            </blockquote>
          ))}
        </div>

        {secondaryQuotes.length ? (
          <details className="rounded-lg border border-white/12 bg-white/35 p-4 dark:bg-white/[0.04]">
            <summary className="cursor-pointer list-none text-sm font-medium text-foreground">
              展开查看更多
            </summary>
            <div className="mt-4 space-y-3">
              {secondaryQuotes.map((quote) => (
                <blockquote
                  key={quote.text}
                  className="rounded-lg border border-white/12 bg-background/65 px-4 py-4"
                >
                  <p className="text-sm leading-7 text-foreground">“{quote.text}”</p>
                  <footer className="mt-3 text-xs text-muted-foreground">
                    {quote.source}
                  </footer>
                </blockquote>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
}
