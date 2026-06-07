export function rankJobs(jobs = [], limit = 30) {
  return [...jobs]
    .sort((a, b) => {
      const aiDelta = (b.match?.aiScore || 0) - (a.match?.aiScore || 0);
      if (aiDelta !== 0) return aiDelta;
      return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
    })
    .slice(0, limit);
}
