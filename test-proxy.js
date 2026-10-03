const handler = async (req, res) => {
  const { path, ...query } = req.query;
  const tmdbPath = Array.isArray(path) ? path.join('/') : path;
  
  console.log("tmdbPath:", tmdbPath);
  const url = new URL(\https://api.themoviedb.org/3/\\);
  for (const [k, v] of Object.entries(query)) {
    url.searchParams.append(k, v);
  }
  console.log("target url:", url.toString());
};

handler({ query: { path: ['search', 'movie'], query: 'batman' } }, {});
handler({ query: { path: 'search/movie', query: 'batman' } }, {});
