import * as movieService from './src/services/movieService.js';

async function test() {
  try {
    const res = await movieService.search({ query: 'batman' });
    console.log("Search Success:", res.items.length);
    console.log("First item:", res.items[0]);
  } catch (err) {
    console.error("Search Error:", err.category, err.message, err.cause);
  }

  try {
    const res2 = await movieService.details(268);
    console.log("Details Success:", res2.title);
  } catch (err) {
    console.error("Details Error:", err.category, err.message, err.cause);
  }
}

test();
