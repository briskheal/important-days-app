import React, { useState } from 'react';
import styles from './SubscribeModal.module.css';

const SubscribeModal = ({ onClose }) => {
  const [showUPI, setShowUPI] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [utr, setUtr] = useState('');
  const [status, setStatus] = useState('');

  const plans = [
    { id: 'trial', name: 'Trial', price: '₹0', duration: '/10 days', icon: '🎁', features: ['All Global Days', 'India Festivals', 'Limited Previews'] },
    { id: 'monthly', name: 'Monthly', price: '₹30', duration: '/month', icon: '🚀', badge: 'Popular', features: ['Priority Support', 'Premium UI', 'Unlimited Content', 'Export Features'] },
    { id: 'annual', name: 'Annual', price: '₹288', duration: '/year', icon: '👑', badge: 'Best Value', features: ['All Month Features', 'Save 20% overall', '24/7 Support'] }
  ];

  const handleSelectPlan = (plan) => {
    if (plan.id === 'trial') {
      onClose();
      return;
    }
    setSelectedPlan(plan);
    setShowUPI(true);
  };

  const handleConfirm = () => {
    if (!utr || utr.length < 12) {
      setStatus('⚠️ Please enter a valid 12-digit UTR number.');
      return;
    }
    setStatus('✅ UTR Submitted! Your subscription is pending verification.');
    setTimeout(() => {
      onClose();
    }, 3000);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>💎 Choose Your Plan</h3>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          {!showUPI ? (
            <>
              <p className={styles.intro}>Unlock the full power of Important Days Calendar. Pick a plan that works for you.</p>
              <div className={styles.plansGrid}>
                {plans.map(plan => (
                  <div key={plan.id} className={`${styles.planCard} ${plan.badge ? styles.featured : ''}`}>
                    {plan.badge && <div className={styles.badge}>{plan.badge}</div>}
                    <div className={styles.planIcon}>{plan.icon}</div>
                    <div className={styles.planName}>{plan.name}</div>
                    <div className={styles.planPrice}>{plan.price}<span>{plan.duration}</span></div>
                    <ul className={styles.planFeatures}>
                      {plan.features.map((feat, i) => <li key={i}>{feat}</li>)}
                    </ul>
                    <button className={styles.selectBtn} onClick={() => handleSelectPlan(plan)}>
                      {plan.id === 'trial' ? 'Start Trial' : 'Get Unlimited'}
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className={styles.upiSection}>
              <div className={styles.upiHeader}>
                <button className={styles.backBtn} onClick={() => setShowUPI(false)}>← Back</button>
                <div className={styles.upiTitle}>
                  <span className={styles.upiIcon}>💳</span>
                  <div>
                    <h4>Pay via UPI</h4>
                    <p>{selectedPlan.name} – {selectedPlan.price}</p>
                  </div>
                </div>
              </div>

              <div className={styles.upiContent}>
                <div className={styles.qrBox}>
                  <div className={styles.qrPlaceholder}>QR Code</div>
                  <p>📷 Scan with any UPI app</p>
                </div>
                <div className={styles.instructions}>
                  <h5>How to Pay</h5>
                  <p>1️⃣ Open PhonePe / GPay / Paytm</p>
                  <p>2️⃣ Scan the QR code</p>
                  <p>3️⃣ Enter the exact amount ({selectedPlan.price})</p>
                  <p>4️⃣ Pay & note your <strong>UTR number</strong></p>
                </div>
              </div>

              <div className={styles.confirmBox}>
                <h5>📋 Enter UTR Number</h5>
                <p>Find the 12-digit UTR / Reference in your UPI app receipt.</p>
                <input 
                  type="text" 
                  placeholder="UTR / Reference (12 digits)" 
                  value={utr} 
                  onChange={e => setUtr(e.target.value)}
                  maxLength={12}
                />
                <button className={styles.submitBtn} onClick={handleConfirm}>🔒 Submit UTR & Activate</button>
                {status && <p className={styles.status}>{status}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubscribeModal;
