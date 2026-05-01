export async function searchRxTerms(query: string): Promise<string[]> {
  if (!query.trim()) return [];
  const url = `https://clinicaltables.nlm.nih.gov/api/rxterms/v3/search?terms=${encodeURIComponent(query)}&maxList=10`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data[1] as string[]) ?? [];
}
