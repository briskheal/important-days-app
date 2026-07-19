import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Admin.module.css';

const Admin = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('payments');

  // Mock Data
  const pendingPayments = [
    { id: 1, user: 'John Doe', phone: '9876543210', utr: 'UTR893452109823', date: '19 Jul 2026', plan: 'Monthly' },
    { id: 2, user: 'Jane Smith', phone: '9988776655', utr: 'UTR567234908123', date: '18 Jul 2026', plan: 'Annual' }
  ];

  return (
    <div className={styles.adminContainer}>
      <header className={styles.adminHeader}>
        <div className={styles.headerLeft}>
          <button className={styles.backBtn} onClick={() => navigate('/')}>← Back</button>
          <h2>⚙️ Admin Control Panel</h2>
        </div>
      </header>

      <div className={styles.layout}>
        <aside className={styles.sidebar}>
          <nav>
            <button 
              className={activeTab === 'payments' ? styles.activeTab : ''} 
              onClick={() => setActiveTab('payments')}
            >💳 Pending Payments</button>
            <button 
              className={activeTab === 'users' ? styles.activeTab : ''} 
              onClick={() => setActiveTab('users')}
            >👥 User Management</button>
            <button 
              className={activeTab === 'content' ? styles.activeTab : ''} 
              onClick={() => setActiveTab('content')}
            >📅 Add/Edit Events</button>
          </nav>
        </aside>

        <main className={styles.mainContent}>
          {activeTab === 'payments' && (
            <section className={styles.section}>
              <h3>Pending Subscriptions</h3>
              <p className={styles.subtext}>Verify UTR numbers and approve accounts.</p>
              
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Phone</th>
                      <th>Plan</th>
                      <th>UTR / Reference</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingPayments.map(p => (
                      <tr key={p.id}>
                        <td>{p.user}</td>
                        <td>{p.phone}</td>
                        <td><span className={styles.badge}>{p.plan}</span></td>
                        <td className={styles.utrCell}>{p.utr}</td>
                        <td>{p.date}</td>
                        <td>
                          <div className={styles.actionBtns}>
                            <button className={styles.approveBtn}>Approve</button>
                            <button className={styles.rejectBtn}>Reject</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeTab === 'users' && (
            <section className={styles.section}>
              <h3>User Management</h3>
              <p className={styles.subtext}>View and manage all registered users.</p>
              <div className={styles.emptyState}>User list will appear here.</div>
            </section>
          )}

          {activeTab === 'content' && (
            <section className={styles.section}>
              <h3>Add New Event</h3>
              <div className={styles.formCard}>
                <div className={styles.inputGroup}>
                  <label>Event Name</label>
                  <input type="text" placeholder="e.g. World Developer Day" />
                </div>
                <div className={styles.inputRow}>
                  <div className={styles.inputGroup}>
                    <label>Date</label>
                    <input type="date" />
                  </div>
                  <div className={styles.inputGroup}>
                    <label>Category</label>
                    <select>
                      <option>International</option>
                      <option>India National</option>
                      <option>Festival</option>
                      <option>Health</option>
                    </select>
                  </div>
                  <div className={styles.inputGroup}>
                    <label>Emoji</label>
                    <input type="text" placeholder="🎉" maxLength="2" />
                  </div>
                </div>
                <div className={styles.inputGroup}>
                  <label>Description</label>
                  <textarea placeholder="Brief summary of the day..."></textarea>
                </div>
                <button className={styles.saveBtn}>Add Event to Database</button>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
};

export default Admin;
