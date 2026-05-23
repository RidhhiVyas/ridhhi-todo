import React, { useState, useEffect, useRef } from 'react';
import { Briefcase, Home, Plus, Check, Trash2, Bell, BellOff, Clock, X, LogOut, Mail } from 'lucide-react';
import { supabase } from './supabase.js';
import { enablePush, getPushStatus, isPushSupported } from './push.js';

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #eef2ff 0%, #fce7f3 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", color: '#6b7280' }}>
        Loading...
      </div>
    );
  }

  return session ? <TodoList session={session} /> : <Login />;
}

function Login() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const sendMagicLink = async () => {
    if (!email.trim()) return;
    setSending(true);
    setError('');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setSending(false);
    if (error) setError(error.message);
    else setSent(true);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #eef2ff 0%, #fce7f3 100%)',
      fontFamily: "'Inter', -apple-system, sans-serif",
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=Inter:wght@400;500;600;700&display=swap');`}</style>
      <div style={{
        background: '#fff', borderRadius: '16px', padding: '40px',
        maxWidth: '420px', width: '100%',
        boxShadow: '0 10px 40px rgba(30, 27, 75, 0.1)',
      }}>
        <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '32px', fontWeight: '700', margin: '0 0 8px 0', color: '#1e1b4b', letterSpacing: '-0.02em' }}>
          Hey Ridhhi 👋
        </h1>
        <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '28px' }}>
          Enter your email to sign in. We'll send you a magic link — no password needed.
        </p>

        {sent ? (
          <div style={{ background: '#ecfdf5', border: '1px solid #10b981', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
            <Mail size={32} style={{ color: '#10b981', marginBottom: '12px' }} />
            <div style={{ color: '#047857', fontWeight: '600', marginBottom: '4px' }}>Check your email</div>
            <div style={{ color: '#065f46', fontSize: '13px' }}>
              We sent a magic link to <strong>{email}</strong>. Click it to sign in.
            </div>
          </div>
        ) : (
          <>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMagicLink()}
              placeholder="your@email.com"
              style={{
                width: '100%', border: '1.5px solid #e5e7eb', background: '#f9fafb',
                padding: '13px 16px', borderRadius: '10px', fontSize: '15px',
                color: '#1e1b4b', fontFamily: 'inherit', marginBottom: '12px',
                boxSizing: 'border-box', outline: 'none',
              }}
            />
            <button
              onClick={sendMagicLink}
              disabled={sending || !email.trim()}
              style={{
                width: '100%', background: '#1e1b4b', color: '#fff', border: 'none',
                borderRadius: '10px', padding: '13px', fontSize: '14px', fontWeight: '600',
                cursor: sending || !email.trim() ? 'not-allowed' : 'pointer',
                opacity: sending || !email.trim() ? 0.5 : 1,
              }}
            >
              {sending ? 'Sending...' : 'Send magic link'}
            </button>
            {error && (
              <div style={{ color: '#dc2626', fontSize: '13px', marginTop: '12px', textAlign: 'center' }}>
                {error}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TodoList({ session }) {
  const [tasks, setTasks] = useState([]);
  const [activeTab, setActiveTab] = useState('office');
  const [newTask, setNewTask] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [newDueTime, setNewDueTime] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active');
  const [notifPermission, setNotifPermission] = useState('default');
  const [toast, setToast] = useState(null);
  const timersRef = useRef({});

  useEffect(() => {
    loadTasks();
    getPushStatus().then(setNotifPermission);

    // Real-time sync across devices
    const channel = supabase
      .channel('tasks-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${session.user.id}` }, () => {
        loadTasks();
      })
      .subscribe();

    return () => {
      Object.values(timersRef.current).forEach(clearTimeout);
      supabase.removeChannel(channel);
    };
  }, [session.user.id]);

  useEffect(() => {
    if (loading) return;
    Object.values(timersRef.current).forEach(clearTimeout);
    timersRef.current = {};
    tasks.forEach(task => {
      if (!task.completed && task.due_at) scheduleNotification(task);
    });
  }, [tasks, loading]);

  const scheduleNotification = (task) => {
    const delay = new Date(task.due_at).getTime() - Date.now();
    if (delay <= 0 || delay > 2147483647) return;
    timersRef.current[task.id] = setTimeout(() => fireNotification(task), delay);
  };

  const fireNotification = (task) => {
    const title = 'Hi Ridhhi, how far are you with your work?';
    const body = `${task.category === 'office' ? '💼' : '🏠'} ${task.text}`;
    if (notifPermission === 'granted' && 'Notification' in window) {
      try { new Notification(title, { body, tag: task.id }); } catch (e) { console.error(e); }
    }
    showToast(title, body);
  };

  const showToast = (title, body) => {
    setToast({ title, body, id: Date.now() });
    setTimeout(() => setToast(null), 8000);
  };

  const requestNotifPermission = async () => {
    if (!isPushSupported()) {
      showToast('Not supported', 'This browser cannot do background notifications.');
      return;
    }
    try {
      await enablePush(session.user.id);
      setNotifPermission('granted');
      showToast('Notifications enabled', 'This device will now get reminders even when the tab is closed.');
    } catch (e) {
      console.error('Push enable failed:', e);
      showToast('Could not enable', e.message || 'Something went wrong enabling notifications.');
    }
  };

  const loadTasks = async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) console.error('Load error:', error);
    else setTasks(data || []);
    setLoading(false);
  };

  const buildDueAt = (timeStr) => {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(':').map(Number);
    const due = new Date();
    due.setHours(h, m, 0, 0);
    if (due.getTime() <= Date.now()) due.setDate(due.getDate() + 1);
    return due.toISOString();
  };

  const addTask = async () => {
    if (!newTask.trim()) return;
    const { error } = await supabase.from('tasks').insert({
      user_id: session.user.id,
      text: newTask.trim(),
      category: activeTab,
      priority: newPriority,
      completed: false,
      due_at: buildDueAt(newDueTime),
    });
    if (error) console.error('Insert error:', error);
    setNewTask('');
    setNewPriority('medium');
    setNewDueTime('');
    loadTasks();
  };

  const toggleTask = async (task) => {
    await supabase.from('tasks').update({
      completed: !task.completed,
      completed_at: !task.completed ? new Date().toISOString() : null,
    }).eq('id', task.id);
    loadTasks();
  };

  const deleteTask = async (id) => {
    await supabase.from('tasks').delete().eq('id', id);
    loadTasks();
  };

  const clearCompleted = async () => {
    await supabase.from('tasks').delete()
      .eq('category', activeTab).eq('completed', true);
    loadTasks();
  };

  const signOut = async () => { await supabase.auth.signOut(); };

  const filteredTasks = tasks.filter(t => {
    if (t.category !== activeTab) return false;
    if (filter === 'active') return !t.completed;
    if (filter === 'completed') return t.completed;
    return true;
  });

  const officeActive = tasks.filter(t => t.category === 'office' && !t.completed).length;
  const personalActive = tasks.filter(t => t.category === 'personal' && !t.completed).length;

  const priorityConfig = {
    high: { label: 'High', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
    medium: { label: 'Med', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
    low: { label: 'Low', color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  };

  const formatDue = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    const isTomorrow = d.getDate() !== new Date().getDate();
    const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return isTomorrow ? `tomorrow, ${timeStr}` : timeStr;
  };

  const isOverdue = (iso) => iso && new Date(iso).getTime() < Date.now();
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #eef2ff 0%, #fce7f3 100%)',
      fontFamily: "'Inter', -apple-system, sans-serif",
      padding: '32px 20px', color: '#1e1b4b', position: 'relative',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        input:focus, select:focus, button:focus { outline: none; }
        .task-item { transition: all 0.2s ease; }
        .task-item:hover { background: #faf9ff !important; }
        .add-btn:hover { background: #312e81 !important; transform: translateY(-1px); }
        .add-btn { transition: all 0.15s ease; }
        .priority-pill:hover { transform: translateY(-1px); }
        @keyframes slideIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideInRight { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        .task-item { animation: slideIn 0.2s ease; }
        .toast { animation: slideInRight 0.3s ease; }
      `}</style>

      {toast && (
        <div className="toast" style={{
          position: 'fixed', top: '20px', right: '20px', background: '#1e1b4b', color: '#fff',
          padding: '16px 20px', borderRadius: '12px', boxShadow: '0 10px 40px rgba(30, 27, 75, 0.3)',
          maxWidth: '340px', zIndex: 1000, display: 'flex', alignItems: 'flex-start', gap: '12px',
        }}>
          <Bell size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#fbbf24' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px' }}>{toast.title}</div>
            <div style={{ fontSize: '13px', opacity: 0.85 }}>{toast.body}</div>
          </div>
          <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0, opacity: 0.6 }}>
            <X size={16} />
          </button>
        </div>
      )}

      <div style={{ maxWidth: '640px', margin: '0 auto' }}>
        <div style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#6366f1', marginBottom: '6px', fontWeight: '600' }}>
              {today}
            </div>
            <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '42px', fontWeight: '700', margin: 0, letterSpacing: '-0.03em', color: '#1e1b4b', lineHeight: 1.1 }}>
              Hey Ridhhi 👋
            </h1>
            <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '6px' }}>
              {officeActive + personalActive} tasks on your plate today
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button
              onClick={notifPermission !== 'granted' ? requestNotifPermission : null}
              style={{
                background: notifPermission === 'granted' ? '#ecfdf5' : '#fff',
                border: `1.5px solid ${notifPermission === 'granted' ? '#10b981' : '#e5e7eb'}`,
                borderRadius: '10px', padding: '10px 14px',
                cursor: notifPermission === 'granted' ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px',
                fontSize: '13px', fontWeight: '600',
                color: notifPermission === 'granted' ? '#047857' : '#4b5563',
              }}
            >
              {notifPermission === 'granted' ? <Bell size={15} /> : <BellOff size={15} />}
              {notifPermission === 'granted' ? 'On' : 'Alerts'}
            </button>
            <button
              onClick={signOut}
              title="Sign out"
              style={{
                background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: '10px',
                padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center',
                color: '#6b7280',
              }}
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '4px', marginBottom: '18px', background: '#fff', padding: '5px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(30, 27, 75, 0.05)' }}>
          {[
            { key: 'office', icon: Briefcase, label: 'Office', count: officeActive },
            { key: 'personal', icon: Home, label: 'Personal', count: personalActive },
          ].map(({ key, icon: Icon, label, count }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                flex: 1, padding: '12px 16px', border: 'none', borderRadius: '8px',
                background: activeTab === key ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)' : 'transparent',
                color: activeTab === key ? '#fff' : '#4b5563',
                cursor: 'pointer', fontSize: '14px', fontWeight: '600',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                transition: 'all 0.2s ease',
              }}
            >
              <Icon size={16} />
              {label}
              <span style={{
                background: activeTab === key ? 'rgba(255,255,255,0.25)' : '#f3f4f6',
                color: activeTab === key ? '#fff' : '#6b7280',
                padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '700',
              }}>{count}</span>
            </button>
          ))}
        </div>

        <div style={{ background: '#fff', borderRadius: '14px', padding: '16px', marginBottom: '18px', boxShadow: '0 1px 3px rgba(30, 27, 75, 0.05)' }}>
          <input
            type="text"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTask()}
            placeholder={`What do you need to do in ${activeTab}?`}
            style={{
              width: '100%', border: 'none', background: '#f9fafb',
              padding: '13px 16px', borderRadius: '10px', fontSize: '15px',
              color: '#1e1b4b', fontFamily: 'inherit', marginBottom: '12px',
            }}
          />
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {Object.entries(priorityConfig).map(([key, cfg]) => (
                <button
                  key={key}
                  className="priority-pill"
                  onClick={() => setNewPriority(key)}
                  style={{
                    background: newPriority === key ? cfg.bg : 'transparent',
                    color: newPriority === key ? cfg.color : '#9ca3af',
                    border: `1.5px solid ${newPriority === key ? cfg.border : '#e5e7eb'}`,
                    borderRadius: '20px', padding: '5px 12px',
                    fontSize: '12px', fontWeight: '600',
                    cursor: 'pointer', transition: 'all 0.15s ease',
                  }}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f9fafb', padding: '4px 12px', borderRadius: '20px', border: '1.5px solid #e5e7eb' }}>
              <Clock size={13} style={{ color: '#6b7280' }} />
              <input
                type="time"
                value={newDueTime}
                onChange={(e) => setNewDueTime(e.target.value)}
                style={{
                  border: 'none', background: 'transparent', fontSize: '12px',
                  color: '#1e1b4b', fontWeight: '600', padding: 0, width: '85px',
                  fontFamily: 'inherit',
                }}
              />
            </div>
            <button
              className="add-btn"
              onClick={addTask}
              style={{
                background: '#1e1b4b', color: '#fff', border: 'none',
                borderRadius: '20px', padding: '8px 18px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '6px',
                fontSize: '13px', fontWeight: '600', marginLeft: 'auto',
              }}
            >
              <Plus size={15} />
              Add task
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', paddingLeft: '4px', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '16px' }}>
            {['active', 'completed', 'all'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  background: 'none', border: 'none', padding: '4px 0',
                  cursor: 'pointer', fontSize: '12px', fontWeight: '700',
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  color: filter === f ? '#4f46e5' : '#9ca3af',
                  borderBottom: filter === f ? '2px solid #4f46e5' : '2px solid transparent',
                  fontFamily: 'inherit',
                }}
              >
                {f}
              </button>
            ))}
          </div>
          {tasks.some(t => t.category === activeTab && t.completed) && (
            <button
              onClick={clearCompleted}
              style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}
            >
              Clear completed
            </button>
          )}
        </div>

        <div style={{ background: '#fff', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(30, 27, 75, 0.05)' }}>
          {loading ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
              Loading your tasks...
            </div>
          ) : filteredTasks.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: '18px', color: '#9ca3af', fontWeight: '500' }}>
                {filter === 'completed' ? 'Nothing completed yet.' :
                 filter === 'active' ? 'All clear! Add a task to get started.' :
                 'No tasks yet — add one above.'}
              </div>
            </div>
          ) : (
            filteredTasks.map((task, idx) => {
              const cfg = priorityConfig[task.priority];
              const overdue = !task.completed && isOverdue(task.due_at);
              return (
                <div key={task.id} className="task-item" style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px',
                  borderBottom: idx < filteredTasks.length - 1 ? '1px solid #f3f4f6' : 'none',
                  background: 'transparent',
                }}>
                  <button
                    onClick={() => toggleTask(task)}
                    style={{
                      background: task.completed ? '#10b981' : 'transparent',
                      border: task.completed ? 'none' : '2px solid #d1d5db',
                      borderRadius: '50%', width: '22px', height: '22px',
                      cursor: 'pointer', padding: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', flexShrink: 0,
                    }}
                  >
                    {task.completed && <Check size={14} strokeWidth={3} />}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '15px',
                      color: task.completed ? '#9ca3af' : '#1e1b4b',
                      textDecoration: task.completed ? 'line-through' : 'none',
                      wordBreak: 'break-word', fontWeight: '500',
                    }}>
                      {task.text}
                    </div>
                    {task.due_at && (
                      <div style={{
                        fontSize: '12px',
                        color: overdue ? '#dc2626' : '#6b7280',
                        marginTop: '3px',
                        display: 'flex', alignItems: 'center', gap: '4px',
                        fontWeight: overdue ? '600' : '500',
                      }}>
                        <Clock size={11} />
                        {overdue && !task.completed ? 'Overdue · ' : 'Due '}
                        {formatDue(task.due_at)}
                      </div>
                    )}
                  </div>
                  <span style={{
                    background: cfg.bg, color: cfg.color,
                    padding: '3px 10px', borderRadius: '12px',
                    fontSize: '11px', fontWeight: '700',
                    opacity: task.completed ? 0.4 : 1,
                    flexShrink: 0, border: `1px solid ${cfg.border}`,
                  }}>
                    {cfg.label}
                  </span>
                  <button
                    onClick={() => deleteTask(task.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '6px', color: '#d1d5db',
                      display: 'flex', borderRadius: '6px',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.background = '#fef2f2'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#d1d5db'; e.currentTarget.style.background = 'transparent'; }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: '#9ca3af' }}>
          Synced across your devices · Reminders work while this tab is open
        </div>
      </div>
    </div>
  );
}
