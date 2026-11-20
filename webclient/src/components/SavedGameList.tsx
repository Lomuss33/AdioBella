import type { ReactNode } from "react";

export default function SavedGameList<T extends { id: string }>({ items, render }: {
  items: readonly T[];
  render: (item: T) => ReactNode;
}) {
  return <ul className="rooms-saved-list">{items.map(item => <li key={item.id}>{render(item)}</li>)}</ul>;
}
