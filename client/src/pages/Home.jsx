import React, { useState } from 'react';
import Calendar from '../components/Calendar';
import Header from '../components/Header';
import UserProfileModal from '../components/UserProfileModal';
import SubscribeModal from '../components/SubscribeModal';

const Home = () => {
  const [showProfile, setShowProfile] = useState(false);
  const [showSubscribe, setShowSubscribe] = useState(false);

  return (
    <div style={{ paddingBottom: '40px' }}>
      <Header 
        onOpenProfile={() => setShowProfile(true)} 
        onOpenSubscribe={() => setShowSubscribe(true)} 
      />
      
      <main style={{ padding: '20px' }}>
        <Calendar />
      </main>

      {showProfile && <UserProfileModal onClose={() => setShowProfile(false)} />}
      {showSubscribe && <SubscribeModal onClose={() => setShowSubscribe(false)} />}
    </div>
  );
};

export default Home;
