import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { Advertisers } from './pages/Advertisers';
import { AdvertiserDetail } from './pages/AdvertiserDetail';
import { AdDetail } from './pages/AdDetail';
import { Compare } from './pages/Compare';
import { Analytics } from './pages/Analytics';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/advertisers" element={<Advertisers />} />
        <Route path="/advertisers/:id" element={<AdvertiserDetail />} />
        <Route path="/ads/:id" element={<AdDetail />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/analytics" element={<Analytics />} />
      </Routes>
    </Router>
  );
}

export default App;
