import { Badge } from "@/components/ui/badge";

type BoardBlock = {
  title: string;
  blockType: string;
  instructions?: string | null;
  contentJson?: unknown;
  answerKeyJson?: unknown;
  hint?: string | null;
} | null;

function asRecord(value: unknown) {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function asMatches(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((item) => {
          if (typeof item !== "object" || item === null) return null;
          const pair = item as Record<string, unknown>;
          return {
            leftIndex: Number(pair.leftIndex),
            rightIndex: Number(pair.rightIndex),
          };
        })
        .filter((item): item is { leftIndex: number; rightIndex: number } => Boolean(item))
    : [];
}

function renderReveal(
  blockType: string,
  content: Record<string, unknown>,
  answerKey: Record<string, unknown>,
) {
  if (blockType === "single-choice") {
    const options = asStringArray(content.options);
    const answerIndex = Number(answerKey.answerIndex ?? -1);
    return <p className="text-sm leading-6 text-emerald-900/90">{options[answerIndex] ?? "Correct answer is not set"}</p>;
  }

  if (blockType === "multiple-choice") {
    const options = asStringArray(content.options);
    const answerIndexes = Array.isArray(answerKey.answers) ? answerKey.answers.map((item) => Number(item)) : [];
    return (
      <div className="flex flex-wrap gap-2">
        {answerIndexes.map((index) => (
          <Badge key={index} variant="success">
            {options[index] ?? `Option ${index + 1}`}
          </Badge>
        ))}
      </div>
    );
  }

  if (blockType === "true-false") {
    return <p className="text-sm leading-6 text-emerald-900/90">{Boolean(answerKey.answer) ? "True" : "False"}</p>;
  }

  if (blockType === "short-answer") {
    const acceptedAnswers = asStringArray(answerKey.acceptedAnswers);
    return (
      <div className="flex flex-wrap gap-2">
        {acceptedAnswers.length ? acceptedAnswers.map((item) => <Badge key={item} variant="success">{item}</Badge>) : <span>No accepted answers yet</span>}
      </div>
    );
  }

  if (blockType === "matching" || blockType === "connect") {
    const leftItems = asStringArray(content.leftItems);
    const rightItems = asStringArray(content.rightItems);
    const matches = asMatches(answerKey.matches);

    return (
      <div className="grid gap-3">
        {matches.map((pair, index) => (
          <div key={`${pair.leftIndex}-${pair.rightIndex}-${index}`} className="grid gap-2 rounded-2xl border border-emerald-200 bg-white/70 p-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <span className="font-medium text-slate-900">{leftItems[pair.leftIndex] ?? `Item ${pair.leftIndex + 1}`}</span>
            <span className="text-center text-emerald-700">{"->"}</span>
            <span className="font-medium text-slate-900">{rightItems[pair.rightIndex] ?? `Match ${pair.rightIndex + 1}`}</span>
          </div>
        ))}
      </div>
    );
  }

  if (blockType === "sort-order") {
    const items = asStringArray(content.items);
    const order = Array.isArray(answerKey.order) ? answerKey.order.map((item) => Number(item)) : [];

    return (
      <ol className="grid gap-3">
        {order.map((itemIndex, index) => (
          <li key={`${itemIndex}-${index}`} className="rounded-2xl border border-emerald-200 bg-white/70 p-3 text-sm text-slate-900">
            <span className="font-semibold text-emerald-800">{index + 1}.</span> {items[itemIndex] ?? `Step ${itemIndex + 1}`}
          </li>
        ))}
      </ol>
    );
  }

  return (
    <pre className="overflow-x-auto whitespace-pre-wrap text-sm leading-6 text-emerald-900/80">
      {JSON.stringify(answerKey, null, 2)}
    </pre>
  );
}

export function BoardBlockView({
  block,
  revealAnswer = false,
}: {
  block: BoardBlock;
  revealAnswer?: boolean;
}) {
  if (!block) {
    return (
      <div className="rounded-3xl border border-dashed bg-white/60 p-10 text-center text-slate-500">
        Block is not selected yet.
      </div>
    );
  }

  const content = asRecord(block.contentJson);
  const answerKey = asRecord(block.answerKeyJson);
  const options = asStringArray(content.options);
  const leftItems = asStringArray(content.leftItems);
  const rightItems = asStringArray(content.rightItems);
  const orderItems = asStringArray(content.items);

  return (
    <div className="space-y-6 rounded-[32px] border bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.95))] p-8 shadow-[0_30px_80px_rgba(15,23,42,0.08)]">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="info">{block.blockType}</Badge>
        {block.hint ? <Badge variant="warning">Hint available</Badge> : null}
      </div>

      <div>
        <h2 className="text-3xl font-bold text-slate-950">{block.title}</h2>
        {block.instructions ? <p className="mt-3 text-base leading-7 text-slate-700">{block.instructions}</p> : null}
      </div>

      {typeof content.body === "string" ? <p className="text-lg leading-8 text-slate-800">{content.body}</p> : null}

      {typeof content.question === "string" ? (
        <div className="space-y-4">
          <p className="text-xl font-semibold text-slate-900">{content.question}</p>

          {options.length ? (
            <div className="grid gap-3">
              {options.map((option, index) => (
                <div key={`${option}-${index}`} className="rounded-2xl border bg-white/80 p-4 text-base text-slate-800">
                  {index + 1}. {option}
                </div>
              ))}
            </div>
          ) : null}

          {(block.blockType === "matching" || block.blockType === "connect") && leftItems.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border bg-white/80 p-5">
                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Left side</p>
                <div className="space-y-3">
                  {leftItems.map((item, index) => (
                    <div key={`${item}-${index}`} className="rounded-2xl border bg-slate-50/90 p-3 text-sm text-slate-800">
                      {index + 1}. {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-3xl border bg-white/80 p-5">
                <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Right side</p>
                <div className="space-y-3">
                  {rightItems.map((item, index) => (
                    <div key={`${item}-${index}`} className="rounded-2xl border bg-slate-50/90 p-3 text-sm text-slate-800">
                      {String.fromCharCode(65 + index)}. {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {block.blockType === "sort-order" && orderItems.length ? (
            <div className="grid gap-3">
              {orderItems.map((item, index) => (
                <div key={`${item}-${index}`} className="rounded-2xl border bg-white/80 p-4 text-base text-slate-800">
                  {item}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {typeof content.task === "string" ? (
        <div className="rounded-2xl border bg-slate-50/80 p-4 text-base leading-7 text-slate-800">{content.task}</div>
      ) : null}

      {block.hint ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
          <p className="text-sm font-semibold text-amber-900">Hint</p>
          <p className="mt-2 text-sm leading-6 text-amber-900/80">{block.hint}</p>
        </div>
      ) : null}

      {revealAnswer ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
          <p className="text-sm font-semibold text-emerald-900">Answer / key</p>
          <div className="mt-3">{renderReveal(block.blockType, content, answerKey)}</div>
        </div>
      ) : null}
    </div>
  );
}
