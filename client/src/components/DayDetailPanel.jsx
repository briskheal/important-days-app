import React, { useState, useRef, useEffect } from 'react';
import styles from './DayDetailPanel.module.css';
import { useAuth } from '../context/AuthContext';

const DayDetailPanel = ({ selectedDay, events, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [aiContent, setAiContent] = useState(null);
  const [error, setError] = useState(null);
  const [rawImagePrompt, setRawImagePrompt] = useState('');
  const [activeVariant, setActiveVariant] = useState(0);
  const [imageSize, setImageSize] = useState('square'); // 'square' | 'landscape'

  const canvasRef = useRef(null);
  const { user } = useAuth();
  const [postFeedback, setPostFeedback] = useState('');

  if (!selectedDay) return null;

  const currentImageUrl = rawImagePrompt 
    ? `https://image.pollinations.ai/prompt/${encodeURIComponent(rawImagePrompt)}?width=${imageSize === 'square' ? '1080' : '1200'}&height=${imageSize === 'square' ? '1080' : '630'}&nologo=true`
    : '';

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
        setRawImagePrompt(data.imagePrompt ? (data.imagePrompt + ' photorealistic, highly detailed, aesthetic') : (event.name + ' holiday celebration aesthetic'));
      } else if (data.story) {
        // Fallback Pollinations format
        setAiContent({
          variants: [data.story, data.fact],
          hashtags: data.bonus_hashtags || '',
          cta: 'Share to spread awareness!'
        });
        setRawImagePrompt(event.name + ' ' + data.story);
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
    
    // Facebook and LinkedIn require the URL parameter to open their composer windows.
    // The user will need to manually remove the link preview in the FB composer if they just want a photo.
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

  const handleDownload = (withText) => {
    if (!currentImageUrl) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = "Anonymous";
    
    // Provide user feedback that download is starting
    setPostFeedback('⏳ Preparing download...');
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw Image
      ctx.drawImage(img, 0, 0);
      
      if (withText) {
        // Add dark gradient overlay for text readability
        const gradientHeight = imageSize === 'square' ? 350 : 250;
        const gradient = ctx.createLinearGradient(0, canvas.height - gradientHeight, 0, canvas.height);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(0.5, 'rgba(0,0,0,0.6)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.9)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, canvas.height - gradientHeight, canvas.width, gradientHeight);
        
        // Dynamic Font Size Calculation
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        
        const text = aiContent.variants[activeVariant];
        const words = text.split(' ');
        
        let fontSize = imageSize === 'square' ? 52 : 44;
        const minFontSize = 20;
        let lines = [];
        let lineHeight = 0;
        
        // Target area: We want the text to fit within the gradient overlay (leaving 60px padding)
        const maxTextHeight = gradientHeight - 60; 
        
        // Auto-shrink loop
        while (fontSize >= minFontSize) {
          ctx.font = `bold ${fontSize}px Outfit, sans-serif`;
          lines = [];
          let currentLine = '';
          
          for(let n = 0; n < words.length; n++) {
            const testLine = currentLine + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            // 80px horizontal padding
            if (metrics.width > canvas.width - 80 && n > 0) {
              lines.push(currentLine.trim());
              currentLine = words[n] + ' ';
            } else {
              currentLine = testLine;
            }
          }
          lines.push(currentLine.trim());
          
          lineHeight = fontSize + Math.max(10, fontSize * 0.3);
          const totalTextHeight = lines.length * lineHeight;
          
          // If the text block fits within the max allowed height, we found the right size!
          if (totalTextHeight <= maxTextHeight || fontSize === minFontSize) {
             break;
          }
          
          fontSize -= 2; // Decrease font size and recalculate
        }

        // Draw lines from bottom up
        let startY = canvas.height - 40;
        
        for (let i = lines.length - 1; i >= 0; i--) {
          ctx.fillText(lines[i], canvas.width / 2, startY - ((lines.length - 1 - i) * lineHeight));
        }
      }

      // Trigger Download
      try {
        const link = document.createElement('a');
        link.download = `Important-Days-${imageSize}-${Date.now()}.jpg`;
        link.href = canvas.toDataURL('image/jpeg', 0.95);
        link.click();
        setPostFeedback('✅ Downloaded successfully!');
      } catch (e) {
        console.error("Canvas export failed", e);
        setPostFeedback('❌ Error generating image. Try again.');
      }
      
      setTimeout(() => setPostFeedback(''), 3000);
    };
    img.src = currentImageUrl;
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
              {currentImageUrl && (
                <div className={styles.imageSection}>
                  <div className={styles.sizeSelectors}>
                    <button 
                      className={imageSize === 'square' ? styles.activeSizeBtn : styles.sizeBtn}
                      onClick={() => setImageSize('square')}
                    >
                      <span>🖼️ Instagram (1:1)</span>
                    </button>
                    <button 
                      className={imageSize === 'landscape' ? styles.activeSizeBtn : styles.sizeBtn}
                      onClick={() => setImageSize('landscape')}
                    >
                      <span>📺 FB/X/LinkedIn (1.91:1)</span>
                    </button>
                  </div>
                  
                  <div className={`${styles.imageContainer} ${styles[imageSize]}`}>
                    <img src={currentImageUrl} alt="AI Generated" className={styles.generatedImage} crossOrigin="anonymous" />
                    <div className={styles.imageOverlay}>
                      <p>{aiContent.variants[activeVariant]}</p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className={styles.postControls}>
                <button className={styles.copyBtn} onClick={handleCopy}>📋 Copy Text</button>
                <div className={styles.downloadGroup}>
                  <button className={styles.downloadBtn} onClick={() => handleDownload(true)}>⬇️ DL w/ Text</button>
                  <button className={styles.downloadBtnAlt} onClick={() => handleDownload(false)}>⬇️ DL Image Only</button>
                </div>
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
