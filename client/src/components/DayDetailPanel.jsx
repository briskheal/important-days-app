import React, { useState, useRef, useEffect } from 'react';
import styles from './DayDetailPanel.module.css';
import { useAuth } from '../context/AuthContext';

const DayDetailPanel = ({ selectedDay, events, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [aiContent, setAiContent] = useState(null);
  const [error, setError] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [activeVariant, setActiveVariant] = useState(0);

  const canvasRef = useRef(null);
  const { user } = useAuth();
  const [postFeedback, setPostFeedback] = useState('');

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
      const res = await fetch(`/api/content?${query.toString()}`);
      if (!res.ok) throw new Error('Failed to generate content');
      
      const data = await res.json();
      
      // Handle either Gemini Pro or Pollinations fallback
      if (data.variants) {
        setAiContent(data);
        if (data.imagePrompt) {
          setImageUrl(`https://image.pollinations.ai/prompt/${encodeURIComponent(data.imagePrompt + ' photorealistic, highly detailed, aesthetic')}?width=1024&height=1024&nologo=true`);
        } else {
          setImageUrl(`https://image.pollinations.ai/prompt/${encodeURIComponent(event.name + ' holiday celebration aesthetic')}?width=1024&height=1024&nologo=true`);
        }
      } else if (data.story) {
        // Fallback Pollinations format
        setAiContent({
          variants: [data.story, data.fact],
          hashtags: data.bonus_hashtags || '',
          cta: 'Share to spread awareness!'
        });
        setImageUrl(`https://image.pollinations.ai/prompt/${encodeURIComponent(event.name + ' ' + data.story)}?width=1024&height=1024&nologo=true`);
      }
      
      setActiveVariant(0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    const text = aiContent.variants[activeVariant];
    const fullText = `${text}\n\n${aiContent.hashtags}\n\n${aiContent.cta}`;
    navigator.clipboard.writeText(fullText);
    alert('✅ Copied to clipboard!');
  };

  const shareToSocial = (platform) => {
    const text = encodeURIComponent(`${aiContent.variants[activeVariant]}\n\n${aiContent.hashtags}`);
    const url = encodeURIComponent(window.location.href);
    
    let shareUrl = '';
    if (platform === 'x') shareUrl = `https://twitter.com/intent/tweet?text=${text}`;
    if (platform === 'fb') shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`;
    if (platform === 'li') shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
    if (platform === 'wa') shareUrl = `https://wa.me/?text=${text}`;
    if (platform === 'ig') shareUrl = `https://www.instagram.com/`;
    
    window.open(shareUrl, '_blank', 'width=600,height=400');
  };

  const handlePostToAll = () => {
    if (!user) {
      setPostFeedback('⚠️ Please login to use Auto-Post.');
      return;
    }
    
    const text = encodeURIComponent(`${aiContent.variants[activeVariant]}\n\n${aiContent.hashtags}`);
    const url = encodeURIComponent(window.location.href);
    
    const selectedSites = [];
    if (user.xAuto) selectedSites.push(`https://twitter.com/intent/tweet?text=${text}`);
    if (user.fbAuto) selectedSites.push(user.fbLink || `https://www.facebook.com/sharer/sharer.php?u=${url}&quote=${text}`);
    if (user.liAuto) selectedSites.push(user.liLink || `https://www.linkedin.com/sharing/share-offsite/?url=${url}`);
    if (user.igAuto) selectedSites.push(user.igLink || 'https://www.instagram.com/');
    
    if (selectedSites.length === 0) {
      setPostFeedback('⚠️ Go to your Profile to enable Auto-Posting for your social networks.');
      return;
    }
    
    setPostFeedback('🚀 Opening selected profiles...');
    selectedSites.forEach((siteUrl, index) => {
      setTimeout(() => {
        window.open(siteUrl, '_blank');
      }, index * 500); // Stagger popups slightly to avoid browser blocking
    });
  };

  const handleDownload = () => {
    if (!imageUrl) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw Image
      ctx.drawImage(img, 0, 0);
      
      // Add dark gradient overlay for text readability
      const gradient = ctx.createLinearGradient(0, canvas.height - 300, 0, canvas.height);
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, 'rgba(0,0,0,0.8)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, canvas.height - 300, canvas.width, 300);
      
      // Add text
      ctx.fillStyle = 'white';
      ctx.font = 'bold 40px Outfit, sans-serif';
      ctx.textAlign = 'center';
      
      // Simple text wrap
      const text = aiContent.variants[activeVariant];
      const words = text.split(' ');
      let line = '';
      let y = canvas.height - 150;
      
      for(let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > canvas.width - 80 && n > 0) {
          ctx.fillText(line, canvas.width / 2, y);
          line = words[n] + ' ';
          y += 50;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, canvas.width / 2, y);

      // Add hashtags
      ctx.font = '30px Inter, sans-serif';
      ctx.fillStyle = '#f472b6'; // accent alt
      ctx.fillText(aiContent.hashtags, canvas.width / 2, y + 60);

      // Trigger Download
      const link = document.createElement('a');
      link.download = `Important-Days-${Date.now()}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.9);
      link.click();
    };
    img.src = imageUrl;
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose}>✕</button>
        <h3 className={styles.title}>Events for {selectedDay}</h3>
        
        {!aiContent ? (
          <>
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
                      {loading ? '✨ Generating Premium Content...' : '✨ Generate AI Social Post'}
                    </button>
                  </div>
                ))}
              </div>
            )}
            {error && <div className={styles.error}>{error}</div>}
          </>
        ) : (
          <div className={styles.aiResultView}>
            <button className={styles.backBtn} onClick={() => setAiContent(null)}>← Back to Events</button>
            
            <div className={styles.previewBox}>
              {imageUrl && (
                <div className={styles.imageContainer}>
                  <img src={imageUrl} alt="AI Generated" className={styles.generatedImage} crossOrigin="anonymous" />
                  <div className={styles.imageOverlay}>
                    <p>{aiContent.variants[activeVariant]}</p>
                  </div>
                </div>
              )}
              
              <div className={styles.postControls}>
                <button className={styles.copyBtn} onClick={handleCopy}>📋 Copy Text</button>
                <button className={styles.downloadBtn} onClick={handleDownload}>⬇️ Download Image</button>
              </div>

              <div className={styles.variantSelector}>
                <p>Select Variant:</p>
                <div className={styles.variantTabs}>
                  {aiContent.variants.map((_, idx) => (
                    <button 
                      key={idx} 
                      className={activeVariant === idx ? styles.activeTab : styles.tab}
                      onClick={() => setActiveVariant(idx)}
                    >
                      Option {idx + 1}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.textContent}>
                <p className={styles.postText}>{aiContent.variants[activeVariant]}</p>
                <p className={styles.hashtags}>{aiContent.hashtags}</p>
                <p className={styles.cta}>{aiContent.cta}</p>
              </div>

              <div className={styles.socialShare}>
                <div className={styles.shareHeader}>
                  <p>Share to Socials:</p>
                  {postFeedback && <span className={styles.postFeedback}>{postFeedback}</span>}
                </div>
                <div className={styles.socialBtns}>
                  <button onClick={() => shareToSocial('x')} style={{background: 'black'}}>𝕏</button>
                  <button onClick={() => shareToSocial('fb')} style={{background: '#1877f2'}}>f</button>
                  <button onClick={() => shareToSocial('li')} style={{background: '#0a66c2'}}>in</button>
                  <button onClick={() => shareToSocial('ig')} style={{background: '#E1306C'}}>IG</button>
                  <button onClick={() => shareToSocial('wa')} style={{background: '#25d366'}}>💬</button>
                </div>
                <button className={styles.postAllBtn} onClick={handlePostToAll}>
                  🚀 Post to All Selected Profiles
                </button>
              </div>
              
              <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DayDetailPanel;
