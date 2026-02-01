import CalorieTracker from './CalorieTracker';
import NutritionTest from './NutritionTest';

function App() {
  // Simple routing based on URL path
  const path = window.location.pathname;

  // /test route shows the nutrition system test page
  if (path === '/test') {
    return <NutritionTest />;
  }

  // Default: main app
  return <CalorieTracker />;
}

export default App;
