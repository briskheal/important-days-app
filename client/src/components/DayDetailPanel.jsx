import React, { useState } from 'react';
import styles from './DayDetailPanel.module.css';

const DayDetailPanel = ({ selectedDay, events, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [aiContent, setAiContent] = useState(null);
  const [error, setError] = useState(null);

  if (!selectedDay) return null;

  const handleGenerateAI = async (event) => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        name: event.name,
        category: event.category,
        desc: event.description
      });
      // In dev, Vite proxies this to the backend
      const res = await fetch(`/api/content?${query.toString()}`);
      
      if (!res.ok) throw new Error('Failed to generate content');
      
      const data = await res.json();
      setAiContent(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
        <h3 className={styles.title}>Events for {selectedDay}</h3>
        
        {events.length === 0 ? (
          <p className={styles.noEvents}>No special events on this day.</p>
        ) : (
          <div className={styles.eventList}>
            {events.map((ev, idx) => (
              <div key={idx} className={styles.eventCard}>
                <div className={styles.eventHeader}>
                  <span className={styles.emoji}>{ev.emoji}</span>
                  <div className={styles.eventInfo}>
                    <h4>{ev.name}</h4>
                    <span className={styles.category}>{ev.category}</span>
                  </div>
                </div>
                <p className={styles.description}>{ev.description}</p>
                
                <button 
                  className={styles.aiBtn} 
                  onClick={() => handleGenerateAI(ev)}
                  disabled={loading}
                >
                  {loading ? '✨ Generating...' : '✨ Generate AI Social Posts'}
                </button>
              </div>
            ))}
          </div>
        )}

        {error && <div className={styles.error}>{error}</div>}

        {aiContent && (
          <div className={styles.aiResult}>
            <h4>Generated Social Media Posts</h4>
            <div className={styles.postsList}>
              {aiContent.variants.map((post, idx) => (
                <div key={idx} className={styles.postItem}>{post}</div>
              ))}
            </div>
            <div className={styles.metaData}>
              <strong>Hashtags:</strong> <p>{aiContent.hashtags}</p>
              <strong>CTA:</strong> <p>{aiContent.cta}</p>
              <strong>Image Prompt:</strong> <p className={styles.imagePrompt}>{aiContent.imagePrompt}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DayDetailPanel;
