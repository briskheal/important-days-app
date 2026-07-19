import React, { useState, useEffect } from 'react';
import { importantDays } from '../data/importantDays';
import DayDetailPanel from './DayDetailPanel';
import styles from './Calendar.module.css';

const Calendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [daysInMonth, setDaysInMonth] = useState([]);
  const [blankDays, setBlankDays] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEvents, setSelectedEvents] = useState([]);

  useEffect(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // First day of the month (0 = Sun, 1 = Mon...)
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    // Total days in the month
    const daysCount = new Date(year, month + 1, 0).getDate();
    
    const blanks = Array.from({ length: firstDayOfMonth }, (_, i) => i);
    const days = Array.from({ length: daysCount }, (_, i) => i + 1);
    
    setBlankDays(blanks);
    setDaysInMonth(days);
  }, [currentDate]);

  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

  const getEventsForDate = (day) => {
    const monthStr = String(currentDate.getMonth() + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const dateStr = `${monthStr}-${dayStr}`;
    return importantDays.filter(event => event.date === dateStr);
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const handleDayClick = (day, events) => {
    setSelectedDate(`${monthNames[currentDate.getMonth()]} ${day}, ${currentDate.getFullYear()}`);
    setSelectedEvents(events);
  };

  return (
    <div className={styles.calendarContainer}>
      <div className={styles.header}>
        <h2 className={styles.title}>📅 Monthly Activity Calendar</h2>
        <div className={styles.nav}>
          <button onClick={prevMonth} aria-label="Previous month">←</button>
          <span className={styles.monthLabel}>{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</span>
          <button onClick={nextMonth} aria-label="Next month">→</button>
        </div>
      </div>
      
      <div className={styles.grid}>
        {/* Days of the week */}
        {weekDays.map(day => <div key={day} className={styles.dowCell}>{day}</div>)}
        
        {/* Blank cells */}
        {blankDays.map(blank => <div key={`blank-${blank}`} className={styles.blankCell}></div>)}
        
        {/* Day cells */}
        {daysInMonth.map(day => {
          const events = getEventsForDate(day);
          const hasEvents = events.length > 0;
          const isToday = day === new Date().getDate() && currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear();
          
          return (
            <div 
              key={day} 
              className={`${styles.dayCell} ${hasEvents ? styles.hasEvents : ''} ${isToday ? styles.today : ''}`}
              onClick={() => handleDayClick(day, events)}
            >
              <div className={styles.dayNum}>{day}</div>
              <ul className={styles.eventList}>
                {events.slice(0, 3).map((event, idx) => (
                  <li key={idx} className={styles.eventItem}>
                    <span className={styles.eventEmoji}>{event.emoji}</span>
                    <span className={styles.eventName}>{event.name}</span>
                  </li>
                ))}
                {events.length > 3 && <li className={styles.eventMore}>+{events.length - 3} more</li>}
              </ul>
            </div>
          );
        })}
      </div>

      {selectedDate && (
        <DayDetailPanel 
          selectedDay={selectedDate} 
          events={selectedEvents} 
          onClose={() => setSelectedDate(null)} 
        />
      )}
    </div>
  );
};

export default Calendar;
