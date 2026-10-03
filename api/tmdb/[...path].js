export default async function handler(req, res) {
  const { path, ...query } = req.query;
  const tmdbPath = Array.isArray(path) ? path.join('/') : path;
  
  const url = new URL(\https://api.themoviedb.org/3/\\);
  for (const [k, v] of Object.entries(query)) {
    url.searchParams.append(k, v);
  }

  const token = process.env.VITE_TMDB_TOKEN;
  const apiKey = process.env.VITE_TMDB_API_KEY;
  
  const headers = {
    'Accept': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = \Bearer \\;
  } else if (apiKey) {
    url.searchParams.append('api_key', apiKey);
  }

  try {
    const response = await fetch(url.toString(), { headers });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch from TMDB' });
  }
}
