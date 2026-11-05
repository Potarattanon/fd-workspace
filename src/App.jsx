import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { 
  Plus, MoreHorizontal, Calendar, CalendarDays, 
  CheckCircle2, Clock, Trash2, BarChart3, Users, 
  PlayCircle, Edit2, Check, MessageCircle, X, Send, ImagePlus, FileText,
  Briefcase, ChevronRight, Pin, Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function AuraBackground({ children }) {
  return (
    <div style={{ position: "relative", overflow: "hidden", minHeight: "100vh", backgroundColor: "#faf8f2", isolation: "isolate" }}>
      <style>{`
        .beautiful-scrollbar::-webkit-scrollbar { height: 12px; width: 12px; }
        .beautiful-scrollbar::-webkit-scrollbar-track { background: rgba(241, 245, 249, 0.4); border-radius: 10px; margin: 0 16px; }
        .beautiful-scrollbar::-webkit-scrollbar-thumb { background: rgba(148, 163, 184, 0.5); border-radius: 10px; border: 3px solid transparent; background-clip: padding-box; }
        .beautiful-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(100, 116, 139, 0.8); border: 3px solid transparent; background-clip: padding-box; }
      `}</style>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(rgba(0,0,0,0) 0%, rgba(200,230,255,0.12) 18%, rgb(255,255,255) 28%, rgb(150,200,255) 68%, rgb(100,130,200) 100%)", mixBlendMode: "multiply", filter: "blur(130px)", pointerEvents: "none" }} aria-hidden="true" />
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(rgba(0,0,0,0) 0%, rgba(200,230,255,0.22) 34%, rgb(255,255,255) 66%, rgb(150,200,255) 82%, rgb(100,130,200) 100%)", mixBlendMode: "multiply", filter: "blur(130px)", pointerEvents: "none" }} aria-hidden="true" />
      <div style={{ position: "relative", zIndex: 1, minHeight: "100vh" }}>{children}</div>
    </div>
  );
}

const MOCK_NOTICES = [
  { id: 'n1', title: 'สมาชิกทีม FD เข้ามาอัปเดตงานทุกๆสัปดาห์ เพื่อให้เห็นข้อมูลความคืบหน้า', date: '11 พ.ย. 2026', author: 'Team Lead', type: 'important' },
  { id: 'n2', title: 'รับทราบคับผม', date: '11 พ.ย. 2026', author: 'Staff', type: 'info' },
];

export default function App() {
  const [loading, setLoading] = useState(true);

  // STATE MANAGEMENT
  const [profiles, setProfiles] = useState([]);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [selectedWorkspaceOwner, setSelectedWorkspaceOwner] = useState(null);
  
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [inlineComments, setInlineComments] = useState([]);

  const [activeProjectId, setActiveProjectId] = useState(null);
  const [editingProjectId, setEditingProjectId] = useState(null);
  
  // Profile Creation State
  const [isAddingProfile, setIsAddingProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileRole, setNewProfileRole] = useState('Staff');
  const [newProfileImageFile, setNewProfileImageFile] = useState(null);
  const [newProfileImagePreview, setNewProfileImagePreview] = useState(null);
  const [isUploadingProfile, setIsUploadingProfile] = useState(false);

  const [activeUpdateTaskId, setActiveUpdateTaskId] = useState(null);
  const [updateInput, setUpdateInput] = useState('');
  const [updateImageFile, setUpdateImageFile] = useState(null);
  const [updateImagePreview, setUpdateImagePreview] = useState(null);
  const fileInputRef = useRef(null);

  const [activeDescTaskId, setActiveDescTaskId] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [updateToDelete, setUpdateToDelete] = useState(null);

  // NOTIFICATION & REALTIME STATE
  const [toasts, setToasts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const currentProfileRef = useRef(currentProfile);
  const projectsRef = useRef(projects);
  const profilesRef = useRef(profiles);

  useEffect(() => { currentProfileRef.current = currentProfile; }, [currentProfile]);
  useEffect(() => { projectsRef.current = projects; }, [projects]);
  useEffect(() => { profilesRef.current = profiles; }, [profiles]);

  const addToast = (title, message) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, title, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  };

  // ================= 1. โหลดข้อมูลจาก SUPABASE =================
  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        (payload) => {
          fetchData();

          const myId = currentProfileRef.current?.id;
          if (!myId) return;

          // จัดการแจ้งเตือน Realtime สำหรับโปรไฟล์ปัจจุบัน
          if (payload.table === 'notifications' && payload.new?.user_id === myId) {
            if (payload.eventType === 'INSERT') {
              setNotifications(prev => [payload.new, ...prev.filter(n => n.id !== payload.new.id)]);
              addToast(payload.new.title, payload.new.message);
            } else if (payload.eventType === 'UPDATE') {
              setNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new : n));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (currentProfile?.id) {
      fetchData(currentProfile.id);
    }
  }, [currentProfile?.id]);

  const fetchData = async (overrideProfileId = null) => {
    try {
      const myId = overrideProfileId || currentProfile?.id || currentProfileRef.current?.id;
      const [profRes, projRes, taskRes, updRes, commRes, notifRes] = await Promise.all([
        supabase.from('profiles').select('*').order('full_name', { ascending: true }),
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('tasks').select('*').order('created_at', { ascending: true }),
        supabase.from('updates').select('*').order('created_at', { ascending: true }),
        supabase.from('inline_comments').select('*').order('created_at', { ascending: true }),
        supabase.from('notifications').select('*').order('created_at', { ascending: false })
      ]);

      if (profRes.data) setProfiles(profRes.data.map(p => ({ id: p.id, name: p.full_name, avatar: p.avatar_url, role: p.role })));
      if (projRes.data) setProjects(projRes.data.map(p => ({ id: p.id, name: p.name, description: p.description, startDate: p.start_date, endDate: p.end_date, status: p.status, workspaceOwnerId: p.workspace_owner_id })));
      if (taskRes.data) setTasks(taskRes.data.map(t => ({ id: t.id, projectId: t.project_id, title: t.title, ownerId: t.owner_id, status: t.status, dueDate: t.due_date, description: t.description, descriptionImage: t.description_image })));
      if (updRes.data) setUpdates(updRes.data.map(u => ({ id: u.id, taskId: u.task_id, userId: u.user_id, text: u.text, image: u.image_url, timestamp: u.created_at })));
      if (commRes.data) setInlineComments(commRes.data.map(c => ({ id: c.id, taskId: c.task_id, userId: c.user_id, text: c.text, timestamp: c.created_at })));
      
      if (notifRes.data) {
        setNotifications(myId ? notifRes.data.filter(n => n.user_id === myId) : notifRes.data);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const uploadImageToStorage = async (file) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const { error } = await supabase.storage.from('task-images').upload(fileName, file);
    if (error) { console.error("Upload error:", error); return null; }
    const { data } = supabase.storage.from('task-images').getPublicUrl(fileName);
    return data.publicUrl;
  };

  // ================= 2. HANDLERS =================
  const getUser = (id) => profiles.find(p => p.id === id) || { name: 'Unknown', avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Unknown', role: 'Staff' };

  const handleProfileImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewProfileImageFile(file);
      setNewProfileImagePreview(URL.createObjectURL(file));
    }
  };

  const handleAddProfileSubmit = async (e) => {
    e.preventDefault();
    if (!newProfileName.trim()) return;
    
    setIsUploadingProfile(true);
    let avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${newProfileName}&backgroundColor=0ea5e9`;

    if (newProfileImageFile) {
      const uploadedUrl = await uploadImageToStorage(newProfileImageFile);
      if (uploadedUrl) avatarUrl = uploadedUrl;
    }

    const { data } = await supabase.from('profiles').insert([{ full_name: newProfileName, avatar_url: avatarUrl, role: newProfileRole }]).select();
    
    if (data) {
      setProfiles([...profiles, { id: data[0].id, name: data[0].full_name, avatar: data[0].avatar_url, role: data[0].role }]);
      setNewProfileName('');
      setNewProfileRole('Staff');
      setNewProfileImageFile(null);
      setNewProfileImagePreview(null);
      setIsAddingProfile(false);
    }
    setIsUploadingProfile(false);
  };

  const handleLogout = () => {
    setCurrentProfile(null);
    setSelectedWorkspaceOwner(null);
    setActiveProjectId(null);
  };

  const handleAddProject = async () => {
    if (!selectedWorkspaceOwner) return;
    const newProjDB = {
      name: 'Untitled Project', description: '',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0],
      status: 'ACTIVE',
      workspace_owner_id: selectedWorkspaceOwner.id
    };
    const { data } = await supabase.from('projects').insert([newProjDB]).select();
    if (data) {
      const p = data[0];
      const newProjState = { id: p.id, name: p.name, description: p.description, startDate: p.start_date, endDate: p.end_date, status: p.status, workspaceOwnerId: p.workspace_owner_id };
      setProjects([newProjState, ...projects]);
      if (!activeProjectId) setActiveProjectId(p.id);
      setEditingProjectId(p.id);
    }
  };

  const handleSaveProject = async (project) => {
    await supabase.from('projects').update({
      name: project.name, description: project.description,
      start_date: project.startDate, end_date: project.endDate
    }).eq('id', project.id);
    setEditingProjectId(null);
  };

  const handleDeleteProject = async (id, e) => {
    e.stopPropagation();
    await supabase.from('projects').delete().eq('id', id);
    setProjects(projects.filter(p => p.id !== id));
    setTasks(tasks.filter(t => t.projectId !== id));
    if (activeProjectId === id) setActiveProjectId(null);
  };

  const handleAddTask = async () => {
    if (!activeProjectId) return;
    const newTaskDB = {
      project_id: activeProjectId, title: '', owner_id: currentProfile.id,
      status: 'NOT STARTED', due_date: new Date().toISOString().split('T')[0]
    };
    const { data } = await supabase.from('tasks').insert([newTaskDB]).select();
    if (data) {
      const t = data[0];
      setTasks([...tasks, { id: t.id, projectId: t.project_id, title: t.title, ownerId: t.owner_id, status: t.status, dueDate: t.due_date, description: '', descriptionImage: null }]);

      // แจ้งเตือนเมื่อสร้าง Task ใน Workspace คนอื่น
      const workspaceOwnerId = selectedWorkspaceOwner?.id;
      if (workspaceOwnerId && workspaceOwnerId !== currentProfile.id) {
        await supabase.from('notifications').insert([{
          user_id: workspaceOwnerId,
          actor_id: currentProfile.id,
          title: 'มี Task ใหม่ใน Workspace',
          message: `${currentProfile.name} ได้สร้าง Task ใหม่ใน Workspace ของคุณ`,
          workspace_id: workspaceOwnerId,
          project_id: activeProjectId,
          task_id: t.id
        }]);
      }
    }
  };

  const handleUpdateTaskState = (id, field, value) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const syncTaskToDB = async (id, field, value) => {
    const dbField = field === 'dueDate' ? 'due_date' : field === 'descriptionImage' ? 'description_image' : field;
    await supabase.from('tasks').update({ [dbField]: value }).eq('id', id);
  };

  const cycleStatus = (currentStatus) => {
    if (currentStatus === 'NOT STARTED') return 'WORKING ON IT';
    if (currentStatus === 'WORKING ON IT') return 'DONE';
    return 'NOT STARTED';
  };

  const deleteTask = async (id) => {
    await supabase.from('tasks').delete().eq('id', id);
    setTasks(tasks.filter(t => t.id !== id));
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUpdateImageFile(file);
      setUpdateImagePreview(URL.createObjectURL(file));
    }
  };

  const handleDescImageUpload = async (e) => {
    const file = e.target.files[0];
    if (file && activeDescTaskId) {
      const publicUrl = await uploadImageToStorage(file);
      if (publicUrl) {
        handleUpdateTaskState(activeDescTaskId, 'descriptionImage', publicUrl);
        await syncTaskToDB(activeDescTaskId, 'descriptionImage', publicUrl);
      }
    }
  };

  const handleAddUpdate = async (e) => {
    e.preventDefault();
    if ((!updateInput.trim() && !updateImageFile) || !activeUpdateTaskId) return;
    
    let imageUrl = null;
    if (updateImageFile) { imageUrl = await uploadImageToStorage(updateImageFile); }

    const { data } = await supabase.from('updates').insert([{
      task_id: activeUpdateTaskId, user_id: currentProfile.id, text: updateInput, image_url: imageUrl
    }]).select();

    if (data) {
      const u = data[0];
      setUpdates([...updates, { id: u.id, taskId: u.task_id, userId: u.user_id, text: u.text, image: u.image_url, timestamp: u.created_at }]);
      
      // ยิงแจ้งเตือนหาเจ้าของ Workspace หรือเจ้าของ Task
      const currentTask = tasks.find(t => t.id === activeUpdateTaskId);
      const workspaceOwnerId = selectedWorkspaceOwner?.id;
      const taskOwnerId = currentTask?.ownerId;

      const recipientId = (workspaceOwnerId && workspaceOwnerId !== currentProfile?.id)
        ? workspaceOwnerId
        : (taskOwnerId && taskOwnerId !== currentProfile?.id ? taskOwnerId : null);

      if (recipientId) {
        await supabase.from('notifications').insert([{
          user_id: recipientId,
          actor_id: currentProfile.id,
          title: 'มีการอัปเดตงาน',
          message: `${currentProfile.name}: "${updateInput.trim() || 'แนบรูปภาพใหม่'}"`,
          workspace_id: workspaceOwnerId,
          project_id: activeProjectId,
          task_id: activeUpdateTaskId
        }]);
      }

      setUpdateInput('');
      setUpdateImageFile(null);
      setUpdateImagePreview(null);
    }
  };

  const confirmDeleteUpdate = async () => {
    if (!updateToDelete) return;

    const { error } = await supabase.from('updates').delete().eq('id', updateToDelete.id);
    if (!error) {
      setUpdates(updates.filter(u => u.id !== updateToDelete.id));
    } else {
      console.error("Error deleting update:", error);
    }
    setUpdateToDelete(null);
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', notif.id);
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
    }

    setIsNotifOpen(false);

    // นำทางไปยัง Workspace -> Project -> Task Updates ทันที
    if (notif.workspace_id) {
      const targetOwner = profiles.find(p => p.id === notif.workspace_id);
      if (targetOwner) setSelectedWorkspaceOwner(targetOwner);
    }
    if (notif.project_id) {
      setActiveProjectId(notif.project_id);
    }
    if (notif.task_id) {
      setActiveUpdateTaskId(notif.task_id);
    }
  };

  const handleAddInlineComment = async (taskId, text) => {
    if (!text.trim()) return;
    const { data } = await supabase.from('inline_comments').insert([{
      task_id: taskId, user_id: currentProfile.id, text: text.trim()
    }]).select();
    
    if (data) {
      const c = data[0];
      setInlineComments(prev => [...prev, { id: c.id, taskId: c.task_id, userId: c.user_id, text: c.text, timestamp: c.created_at }]);

      // ยิงแจ้งเตือนเมื่อมีคนคอมเมนต์ในตารางงาน
      const currentTask = tasks.find(t => t.id === taskId);
      const workspaceOwnerId = selectedWorkspaceOwner?.id;
      const taskOwnerId = currentTask?.ownerId;

      const recipientId = (workspaceOwnerId && workspaceOwnerId !== currentProfile?.id)
        ? workspaceOwnerId
        : (taskOwnerId && taskOwnerId !== currentProfile?.id ? taskOwnerId : null);

      if (recipientId) {
        await supabase.from('notifications').insert([{
          user_id: recipientId,
          actor_id: currentProfile.id,
          title: 'ความคิดเห็นใหม่ในตารางงาน',
          message: `${currentProfile.name}: "${text.trim()}"`,
          workspace_id: workspaceOwnerId,
          project_id: activeProjectId,
          task_id: taskId
        }]);
      }
    }
  };

  // COMPUTED VALUES
  const workspaceProjects = selectedWorkspaceOwner 
    ? projects.filter(p => p.workspaceOwnerId === selectedWorkspaceOwner.id) 
    : [];
  
  const activeProject = workspaceProjects.find(p => p.id === activeProjectId) || workspaceProjects[0];
  const activeTasks = activeProject ? tasks.filter(t => t.projectId === activeProject.id) : [];
  const activeTaskForUpdate = tasks.find(t => t.id === activeUpdateTaskId);
  const activeTaskForDesc = tasks.find(t => t.id === activeDescTaskId);
  
  let progress = 0; let daysLeft = 0; let upcomingTasks = [];
  if (activeProject) {
    const total = activeTasks.length;
    const done = activeTasks.filter(t => t.status === 'DONE').length;
    progress = total === 0 ? 0 : Math.round((done / total) * 100);
    daysLeft = Math.ceil((new Date(activeProject.endDate) - new Date()) / (1000 * 60 * 60 * 24));
    upcomingTasks = activeTasks.filter(t => t.status !== 'DONE').sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).slice(0, 3);
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'DONE': return 'bg-emerald-500';
      case 'WORKING ON IT': return 'bg-amber-400';
      case 'NOT STARTED': return 'bg-slate-400';
      default: return 'bg-slate-300';
    }
  };
  const getProgressColor = (p) => {
    if (p === 0) return 'bg-slate-200';
    if (p <= 25) return 'bg-red-500';
    if (p <= 50) return 'bg-orange-500';
    if (p <= 75) return 'bg-yellow-400';
    if (p < 100) return 'bg-lime-400';
    return 'bg-emerald-500';
  };

  if (loading) {
    return <AuraBackground><div className="flex items-center justify-center min-h-screen text-slate-500 font-bold text-xl animate-pulse">Loading Workspace...</div></AuraBackground>;
  }

  // ================= 1. VIEW: PROFILE SELECTION (เลือกตัวตน) =================
  if (!currentProfile) {
    return (
      <AuraBackground>
        <div className="flex flex-col items-center justify-center min-h-screen p-6">
          <motion.h1 initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-4xl md:text-5xl font-extrabold text-slate-800 mb-12 tracking-tight text-center drop-shadow-sm">Who's working today?</motion.h1>
          <div className="flex flex-wrap justify-center gap-8 md:gap-12 max-w-4xl">
            <AnimatePresence>
              {profiles.map((profile) => (
                <motion.div key={profile.id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} whileHover={{ scale: 1.05 }} className="flex flex-col items-center cursor-pointer group" onClick={() => setCurrentProfile(profile)}>
                  <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl bg-white shadow-xl overflow-hidden mb-3 border-4 border-transparent group-hover:border-blue-400 transition-all duration-300">
                    <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" />
                  </div>
                  <span className="text-lg font-bold text-slate-700 group-hover:text-blue-600 transition-colors">{profile.name}</span>
                  <span className="text-xs font-semibold text-slate-400">{profile.role}</span>
                </motion.div>
              ))}
            </AnimatePresence>

            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} whileHover={!isAddingProfile ? { scale: 1.05 } : {}} className="flex flex-col items-center">
              {isAddingProfile ? (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center bg-white/80 backdrop-blur-xl border border-white p-6 rounded-[2rem] shadow-xl w-72">
                  <h3 className="font-extrabold text-slate-700 mb-3 text-base">New Profile</h3>
                  
                  <input type="file" id="profile-img-upload" accept="image/*" className="hidden" onChange={handleProfileImageSelect} />
                  <label htmlFor="profile-img-upload" className="w-20 h-20 rounded-2xl bg-white border-2 border-dashed border-slate-300 flex flex-col items-center justify-center mb-3 cursor-pointer hover:border-blue-400 transition-all overflow-hidden group shadow-sm">
                    {newProfileImagePreview ? (
                      <img src={newProfileImagePreview} alt="preview" className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <ImagePlus className="w-5 h-5 text-slate-400 group-hover:text-blue-500 mb-1" />
                        <span className="text-[9px] font-bold text-slate-400 group-hover:text-blue-500">Photo</span>
                      </>
                    )}
                  </label>

                  <input autoFocus value={newProfileName} onChange={e => setNewProfileName(e.target.value)} placeholder="Your Name" className="w-full text-center outline-none text-slate-700 text-sm font-bold bg-white px-3 py-2 rounded-xl border border-slate-200 focus:border-blue-400 mb-3 shadow-inner" />
                  
                  <select value={newProfileRole} onChange={e => setNewProfileRole(e.target.value)} className="w-full text-center outline-none text-slate-700 text-xs font-bold bg-white px-3 py-2 rounded-xl border border-slate-200 focus:border-blue-400 mb-4 shadow-inner cursor-pointer">
                    <option value="Team Lead">Team Lead</option>
                    <option value="Staff">Staff</option>
                    <option value="Intern">Intern</option>
                  </select>

                  <div className="flex gap-2 w-full">
                    <button onClick={() => { setIsAddingProfile(false); setNewProfileImageFile(null); setNewProfileImagePreview(null); setNewProfileName(''); }} className="flex-1 py-2 bg-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-300 transition-colors">Cancel</button>
                    <button onClick={handleAddProfileSubmit} disabled={!newProfileName.trim() || isUploadingProfile} className="flex-1 py-2 bg-blue-500 text-white rounded-xl text-xs font-bold hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center justify-center">
                      {isUploadingProfile ? <Clock className="w-3.5 h-3.5 animate-spin" /> : 'Create'}
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="cursor-pointer flex flex-col items-center group" onClick={() => setIsAddingProfile(true)}>
                  <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-3xl bg-white/40 border-4 border-dashed border-slate-300 shadow-sm flex items-center justify-center mb-3 group-hover:border-blue-400 group-hover:bg-white/60 transition-all duration-300">
                    <Plus className="w-10 h-10 text-slate-400 group-hover:text-blue-500 transition-colors" />
                  </div>
                  <span className="text-lg font-bold text-slate-500 group-hover:text-blue-600 transition-colors">Add Profile</span>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </AuraBackground>
    );
  }

  // ================= 2. VIEW: WORKSPACE SELECTOR & NOTICE BOARD =================
  if (!selectedWorkspaceOwner) {
    return (
      <AuraBackground>
        <div className="min-h-screen p-4 md:p-6 lg:p-8 flex flex-col items-center">
          
          <header className="w-full max-w-7xl bg-white/60 backdrop-blur-xl border border-white/80 rounded-3xl px-6 py-4 flex justify-between items-center mb-10 shadow-sm z-10 sticky top-4">
            <div>
              <h1 className="text-2xl font-extrabold text-blue-600 tracking-tight">FD Workspace</h1>
              <p className="text-sm font-medium text-slate-500">Project management and tracking</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 bg-white/80 px-3 py-1.5 rounded-full border border-slate-200/60 shadow-sm">
                <img src={currentProfile.avatar} alt="Avatar" className="w-8 h-8 rounded-full shadow-sm object-cover" />
                <span className="font-bold text-slate-700 pr-2">{currentProfile.name}</span>
              </div>

              {/* NOTIFICATION BELL & DROPDOWN */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsNotifOpen(!isNotifOpen)}
                  className="relative p-2.5 rounded-2xl bg-white/80 hover:bg-white text-slate-600 border border-slate-200/80 shadow-sm transition-all cursor-pointer"
                >
                  <Bell className="w-4 h-4" />
                  {notifications.filter(n => !n.is_read).length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-md animate-pulse">
                      {notifications.filter(n => !n.is_read).length}
                    </span>
                  )}
                </button>

                <AnimatePresence>
                  {isNotifOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-3 w-80 sm:w-96 bg-white/95 backdrop-blur-2xl border border-slate-200/90 rounded-3xl shadow-2xl z-[120] overflow-hidden flex flex-col"
                    >
                      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <span className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                          <Bell className="w-4 h-4 text-blue-500" /> การแจ้งเตือน
                        </span>
                        <span className="text-[11px] text-slate-400 font-bold">
                          ค้าง {notifications.filter(n => !n.is_read).length} รายการ
                        </span>
                      </div>

                      <div className="max-h-[380px] overflow-y-auto beautiful-scrollbar p-2 flex flex-col gap-1.5">
                        {notifications.length === 0 ? (
                          <div className="py-10 text-center text-slate-400 text-xs font-medium">
                            ยังไม่มีการแจ้งเตือน
                          </div>
                        ) : (
                          notifications.map((notif) => {
                            const actor = getUser(notif.actor_id);
                            return (
                              <div
                                key={notif.id}
                                onClick={() => handleNotificationClick(notif)}
                                className={`p-3 rounded-2xl flex items-start gap-3 cursor-pointer transition-all ${
                                  notif.is_read ? 'opacity-60 hover:opacity-100 bg-white hover:bg-slate-50' : 'bg-blue-50/60 border border-blue-100/80 hover:bg-blue-50'
                                }`}
                              >
                                <img src={actor?.avatar} alt="Avatar" className="w-8 h-8 rounded-full object-cover shrink-0 mt-0.5 border border-white shadow-sm" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-center mb-0.5">
                                    <h5 className="font-bold text-xs text-slate-800 truncate">{notif.title}</h5>
                                    <span className="text-[9px] text-slate-400 shrink-0 font-medium">
                                      {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{notif.message}</p>
                                </div>
                                {!notif.is_read && (
                                  <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2"></span>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button onClick={handleLogout} className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors bg-white/50 px-4 py-2.5 rounded-full border border-slate-200 hover:bg-white">
                <Users className="w-4 h-4" /> Switch Profile
              </button>
            </div>
          </header>

          <main className="w-full max-w-7xl flex flex-col lg:flex-row gap-8 relative items-start">
            <div className="flex-1 w-full">
              <div className="mb-6">
                <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Team Workspaces</h2>
                <p className="text-sm font-medium text-slate-500 mt-1">เลือกพื้นที่ทำงานเพื่อสร้างหรือติดตามสถานะงานของแต่ละคน</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence>
                  {profiles.map((profile) => {
                    const profProjects = projects.filter(p => p.workspaceOwnerId === profile.id);
                    const profTasks = tasks.filter(t => profProjects.some(p => p.id === t.projectId));
                    const pendingCount = profTasks.filter(t => t.status !== 'DONE').length;

                    return (
                      <motion.div key={profile.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -5, scale: 1.02 }} onClick={() => { setSelectedWorkspaceOwner(profile); const firstProj = projects.find(p => p.workspaceOwnerId === profile.id); setActiveProjectId(firstProj ? firstProj.id : null); }}
                        className="bg-white/80 backdrop-blur-xl border border-white rounded-3xl p-6 shadow-sm hover:shadow-[0_10px_40px_rgba(59,130,246,0.15)] cursor-pointer transition-all relative overflow-hidden group"
                      >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-bl-[100px] -z-10 group-hover:scale-125 transition-transform duration-500"></div>
                        <div className="flex items-start gap-4 mb-6 relative z-10">
                          <img src={profile.avatar} alt={profile.name} className="w-14 h-14 rounded-2xl shadow-sm border-2 border-white group-hover:border-blue-200 object-cover transition-colors" />
                          <div>
                            <h3 className="font-extrabold text-lg text-slate-800">{profile.name}</h3>
                            <span className="text-xs font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">{profile.role}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-slate-500 border-t border-slate-100 pt-4 relative z-10">
                          <div className="flex items-center gap-1.5 text-xs font-bold"><Briefcase className="w-4 h-4 text-slate-400" /><span>{profProjects.length} Projects</span></div>
                          <div className="flex items-center gap-1.5 text-xs font-bold"><CheckCircle2 className="w-4 h-4 text-slate-400" /><span className={`${pendingCount > 0 ? 'text-amber-500' : 'text-slate-500'}`}>{pendingCount} Tasks pending</span></div>
                        </div>
                        <div className="absolute bottom-5 right-5 text-blue-500 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all"><ChevronRight className="w-5 h-5" /></div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>

            <aside className="w-full lg:w-[380px] shrink-0">
              <div className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-[2.5rem] p-6 shadow-sm min-h-[400px] relative overflow-hidden flex flex-col">
                <div className="flex items-center justify-between mb-6 relative z-10">
                  <h2 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2"><Pin className="w-5 h-5 text-rose-500 fill-rose-100" /> Notice Board</h2>
                </div>
                <div className="flex flex-col gap-4 relative z-10 flex-1">
                  {MOCK_NOTICES.map((notice) => (
                    <div key={notice.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 relative group">
                      <div className={`absolute top-0 right-0 w-2 h-full rounded-r-2xl ${notice.type === 'important' ? 'bg-rose-500' : 'bg-blue-400'}`}></div>
                      <h4 className="font-bold text-slate-800 text-sm mb-1 pr-4">{notice.title}</h4>
                      <div className="flex items-center justify-between mt-3 text-[10px] font-bold text-slate-400 uppercase">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {notice.author}</span>
                        <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" /> {notice.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-rose-200/20 rounded-full blur-3xl pointer-events-none"></div>
              </div>
            </aside>
          </main>
        </div>
      </AuraBackground>
    );
  }

  // ================= 3. VIEW: MAIN WORKSPACE =================
  return (
    <AuraBackground>
      <div className="min-h-screen p-4 md:p-6 lg:p-8 flex flex-col items-center">
        
        <header className="w-full max-w-[96vw] bg-white/60 backdrop-blur-xl border border-white/80 rounded-3xl px-6 py-4 flex justify-between items-center mb-6 shadow-sm z-10 sticky top-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedWorkspaceOwner(null)} className="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl border border-blue-200 transition-colors">← Back to Workspaces</button>
            <div>
              <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">{selectedWorkspaceOwner.name}'s Workspace</h1>
              <p className="text-xs font-medium text-slate-500">Viewing as: {currentProfile.name} ({currentProfile.role})</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 bg-white/80 px-3 py-1.5 rounded-full border border-slate-200/60 shadow-sm">
              <img src={currentProfile.avatar} alt="Avatar" className="w-8 h-8 rounded-full bg-blue-100 object-cover" />
              <span className="font-bold text-slate-700 pr-2">{currentProfile.name}</span>
            </div>

            {/* NOTIFICATION BELL & DROPDOWN */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="relative p-2.5 rounded-2xl bg-white/80 hover:bg-white text-slate-600 border border-slate-200/80 shadow-sm transition-all cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {notifications.filter(n => !n.is_read).length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-md animate-pulse">
                    {notifications.filter(n => !n.is_read).length}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {isNotifOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-3 w-80 sm:w-96 bg-white/95 backdrop-blur-2xl border border-slate-200/90 rounded-3xl shadow-2xl z-[120] overflow-hidden flex flex-col"
                  >
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                      <span className="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                        <Bell className="w-4 h-4 text-blue-500" /> การแจ้งเตือน
                      </span>
                      <span className="text-[11px] text-slate-400 font-bold">
                        ค้าง {notifications.filter(n => !n.is_read).length} รายการ
                      </span>
                    </div>

                    <div className="max-h-[380px] overflow-y-auto beautiful-scrollbar p-2 flex flex-col gap-1.5">
                      {notifications.length === 0 ? (
                        <div className="py-10 text-center text-slate-400 text-xs font-medium">
                          ยังไม่มีการแจ้งเตือน
                        </div>
                      ) : (
                        notifications.map((notif) => {
                          const actor = getUser(notif.actor_id);
                          return (
                            <div
                              key={notif.id}
                              onClick={() => handleNotificationClick(notif)}
                              className={`p-3 rounded-2xl flex items-start gap-3 cursor-pointer transition-all ${
                                notif.is_read ? 'opacity-60 hover:opacity-100 bg-white hover:bg-slate-50' : 'bg-blue-50/60 border border-blue-100/80 hover:bg-blue-50'
                              }`}
                            >
                              <img src={actor?.avatar} alt="Avatar" className="w-8 h-8 rounded-full object-cover shrink-0 mt-0.5 border border-white shadow-sm" />
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center mb-0.5">
                                  <h5 className="font-bold text-xs text-slate-800 truncate">{notif.title}</h5>
                                  <span className="text-[9px] text-slate-400 shrink-0 font-medium">
                                    {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{notif.message}</p>
                              </div>
                              {!notif.is_read && (
                                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-2"></span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button onClick={handleLogout} className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors bg-white/50 px-4 py-2.5 rounded-full border border-slate-200 hover:bg-white"><Users className="w-4 h-4" /> Switch</button>
          </div>
        </header>

        <div className="w-full max-w-[96vw] flex flex-col lg:flex-row gap-6 relative items-start">
          
          {/* LEFT SIDEBAR: Projects */}
          <aside className="w-full lg:w-[280px] bg-white/60 backdrop-blur-xl border border-white/80 rounded-3xl p-4 shadow-sm flex flex-col shrink-0 sticky top-[100px] max-h-[calc(100vh-120px)]">
            <div className="flex items-center justify-between mb-4 px-1">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 tracking-tight"><CalendarDays className="w-5 h-5 text-blue-500" /> Projects</h2>
              <button onClick={handleAddProject} className="flex items-center gap-1 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 border border-slate-200/80 shadow-sm"><Plus className="w-3.5 h-3.5" /> New</button>
            </div>
            <div className="flex flex-col gap-3 overflow-y-auto pr-2 pb-4 flex-1 custom-scrollbar">
              <AnimatePresence>
                {workspaceProjects.length === 0 && (
                  <motion.div initial={{opacity:0}} animate={{opacity:1}} className="text-center p-6 bg-white/40 rounded-3xl border-2 border-dashed border-slate-300 text-slate-500 font-medium text-xs mt-2 shadow-inner">
                    <div className="flex justify-center mb-2"><PlayCircle className="w-8 h-8 text-slate-300" /></div>No projects in this workspace.
                  </motion.div>
                )}
                
                {workspaceProjects.map(project => {
                  const isActive = project.id === activeProjectId;
                  const isEditing = project.id === editingProjectId;
                  const projTasks = tasks.filter(t => t.projectId === project.id);
                  const doneProjTasks = projTasks.filter(t => t.status === 'DONE').length;
                  const projProgress = projTasks.length === 0 ? 0 : Math.round((doneProjTasks / projTasks.length) * 100);
                  
                  let badge = { text: 'Not Started', color: 'bg-slate-100 text-slate-500' };
                  if (projProgress === 100 && projTasks.length > 0) badge = { text: 'Completed', color: 'bg-emerald-100 text-emerald-600' };
                  else if (projProgress > 0) badge = { text: 'In Progress', color: 'bg-amber-100 text-amber-600' };

                  return (
                    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} key={project.id} onClick={() => !isEditing && setActiveProjectId(project.id)}
                      className={`group cursor-pointer p-4 rounded-3xl border-2 transition-all duration-300 relative ${isActive ? 'bg-white shadow-[0_4px_20px_rgba(59,130,246,0.1)] border-blue-400 ring-4 ring-blue-50' : 'bg-white/50 border-white hover:bg-white/80 hover:shadow-sm hover:border-slate-200'}`}
                    >
                      {isEditing ? (
                        <div className="relative z-10" onClick={e => e.stopPropagation()}>
                          <button onClick={() => handleSaveProject(project)} className="absolute top-0 right-0 p-1.5 bg-blue-100 text-blue-600 rounded-lg transition-all hover:bg-blue-200 hover:scale-105 z-20"><Check className="w-3.5 h-3.5" /></button>
                          <input type="text" value={project.name} onChange={(e) => setProjects(projects.map(p => p.id === project.id ? {...p, name: e.target.value} : p))} placeholder="Project Name" className="font-extrabold text-base bg-transparent outline-none w-full border-b-2 border-transparent focus:border-blue-300 text-blue-600 pr-8 mb-2" />
                          <textarea value={project.description} onChange={(e) => setProjects(projects.map(p => p.id === project.id ? {...p, description: e.target.value} : p))} placeholder="Add details..." rows={2} className="text-xs font-medium text-slate-500 w-full bg-transparent outline-none mb-3 border-b border-transparent focus:border-slate-300 resize-none min-h-[30px]" />
                          <div className="flex gap-2 mt-1 pt-3 border-t border-slate-100">
                            <input type="date" value={project.startDate} onChange={e => setProjects(projects.map(p => p.id === project.id ? {...p, startDate: e.target.value} : p))} className="bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 outline-none text-slate-600 font-medium text-[10px] w-full" />
                            <input type="date" value={project.endDate} onChange={e => setProjects(projects.map(p => p.id === project.id ? {...p, endDate: e.target.value} : p))} className="bg-slate-50 border border-slate-100 rounded-lg px-2 py-1 outline-none text-slate-600 font-medium text-[10px] w-full" />
                          </div>
                        </div>
                      ) : (
                        <div className="relative z-10">
                          <div className="absolute top-0 right-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-20">
                            <button onClick={(e) => { e.stopPropagation(); setEditingProjectId(project.id); }} className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 shadow-sm"><Edit2 className="w-3.5 h-3.5" /></button>
                            <button onClick={(e) => handleDeleteProject(project.id, e)} className="p-1.5 bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-100 shadow-sm"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                          <div className="flex flex-col items-start gap-1 mb-2 pr-12">
                            <h4 className={`font-extrabold text-base truncate max-w-full ${isActive ? 'text-blue-600' : 'text-slate-700'}`}>{project.name}</h4>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${badge.color}`}>{badge.text}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-3 text-slate-400 font-medium text-[11px]"><Calendar className="w-3.5 h-3.5" /> {new Date(project.startDate).toLocaleDateString('en-US', {month:'short', day:'numeric'})} - {new Date(project.endDate).toLocaleDateString('en-US', {month:'short', day:'numeric'})}</div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </aside>

          {/* RIGHT MAIN AREA */}
          <main className="flex-1 flex flex-col gap-6 min-w-0">
            {activeProject ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
                  <div className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-3xl p-5 shadow-sm flex flex-col justify-between relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-400/20 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-125 duration-700"></div>
                    <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold mb-3 relative z-10 uppercase tracking-wider"><BarChart3 className="w-4 h-4 text-indigo-500" /> Current Status</div>
                    <div className="relative z-10">
                      <div className="flex items-end justify-between mb-2">
                        <h3 className="text-2xl lg:text-3xl font-extrabold text-slate-800 tracking-tight leading-none">{progress === 100 ? 'Completed' : progress > 0 ? 'In Progress' : 'Not Started'}</h3>
                        <div className={`px-2.5 py-1 rounded-full text-xs font-bold shadow-sm ${daysLeft > 0 ? 'bg-amber-100/80 text-amber-600' : 'bg-rose-100/80 text-rose-600'}`}>{daysLeft > 0 ? `${daysLeft} days left` : 'Deadline passed'}</div>
                      </div>
                      <div className="w-full bg-slate-200/80 rounded-full h-2.5 mt-3 overflow-hidden shadow-inner">
                        <div className={`h-full rounded-full transition-all duration-1000 ease-out shadow-sm ${getProgressColor(progress)}`} style={{ width: `${progress}%` }}></div>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 mt-2 font-bold uppercase tracking-wider"><span>Start: {activeProject.startDate}</span><span className="text-indigo-600">{progress}% Complete</span></div>
                    </div>
                  </div>

                  <div className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-3xl p-5 shadow-sm flex flex-col relative overflow-hidden group">
                    <div className="absolute bottom-0 right-0 w-32 h-32 bg-emerald-400/20 rounded-full blur-2xl -mr-10 -mb-10 transition-transform group-hover:scale-125 duration-700"></div>
                    <div className="flex items-center gap-1.5 text-slate-500 text-xs font-bold mb-3 relative z-10 uppercase tracking-wider"><Calendar className="w-4 h-4 text-emerald-500" /> Upcoming Deadlines</div>
                    <div className="flex flex-col gap-2 flex-1 justify-center relative z-10">
                      {upcomingTasks.map((task) => (
                        <div key={task.id} className="flex items-center justify-between bg-white/80 px-3 py-1.5 rounded-xl border border-slate-100 shadow-sm"><div className="flex items-center gap-2.5 truncate pr-4"><div className={`w-2 h-2 rounded-full shadow-sm shrink-0 ${task.status === 'WORKING ON IT' ? 'bg-amber-400' : 'bg-slate-300'}`}></div><span className="text-xs font-semibold text-slate-700 truncate">{task.title || 'Untitled Task'}</span></div><span className="text-[10px] text-slate-600 font-bold whitespace-nowrap bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-lg">{new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric'})}</span></div>
                      ))}
                      {upcomingTasks.length === 0 && <div className="text-xs text-slate-400 font-medium text-center border border-dashed border-slate-200 rounded-xl py-4 bg-white/50">No tasks scheduled</div>}
                    </div>
                  </div>
                </div>

                {/* TABLE AREA */}
                <div className="bg-white/70 backdrop-blur-2xl rounded-3xl shadow-sm border border-white flex flex-col overflow-hidden w-full">
                  <div className="px-6 py-4 border-b border-slate-200/60 bg-white/60 backdrop-blur-sm flex justify-between items-center z-10">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg"><CheckCircle2 className="w-5 h-5 text-blue-500" /> Tasks <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-xs ml-1">{activeTasks.length}</span></h3>
                    <button className="text-slate-400 hover:text-slate-600"><MoreHorizontal className="w-5 h-5" /></button>
                  </div>

                  <div className="overflow-x-auto w-full beautiful-scrollbar pb-2 relative">
                    <table className="w-full text-sm text-left whitespace-nowrap min-w-[1150px]">
                      <thead className="text-xs uppercase text-slate-400 bg-[#2b2f3e]">
                        <tr>
                          <th className="py-3 px-4 font-medium w-12 min-w-[48px] max-w-[48px] text-center border-r border-[#3b4050] sticky left-0 top-0 z-40 bg-[#2b2f3e]"></th>
                          <th className="py-3 px-4 font-medium border-r border-[#3b4050] w-[350px] min-w-[350px] max-w-[350px] sticky left-[48px] top-0 z-40 bg-[#2b2f3e] shadow-[4px_0_8px_-4px_rgba(0,0,0,0.2)]">Task</th>
                          <th className="py-3 px-4 w-28 font-medium border-r border-[#3b4050] text-center bg-[#2b2f3e]">Owner</th>
                          <th className="py-3 px-4 w-40 font-medium border-r border-[#3b4050] text-center bg-[#2b2f3e]">Status</th>
                          <th className="py-3 px-4 w-40 font-medium border-r border-[#3b4050] bg-[#2b2f3e]">Due Date</th>
                          <th className="py-3 px-4 font-medium border-r border-[#3b4050] min-w-[200px] w-64 bg-[#2b2f3e]">Description</th>
                          <th className="py-3 px-4 font-medium border-r border-[#3b4050] min-w-[250px] bg-[#2b2f3e]">Comment</th>
                          <th className="py-3 px-2 w-10 font-medium text-center bg-[#2b2f3e]"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <AnimatePresence>
                          {activeTasks.map((task) => {
                            const isDone = task.status === 'DONE';
                            const tUpdates = updates.filter(u => u.taskId === task.id);
                            const tComments = inlineComments.filter(c => c.taskId === task.id);
                            
                            return (
                              <motion.tr key={task.id} initial={{ opacity: 0, backgroundColor: "#f8fafc" }} animate={{ opacity: 1, backgroundColor: "#ffffff" }} exit={{ opacity: 0, backgroundColor: "#fef2f2" }} className="group hover:bg-slate-50/80 transition-colors relative">
                                <td className="py-2.5 px-4 border-r border-slate-200 align-top pt-4 sticky left-0 z-30 bg-inherit group-hover:bg-slate-50 transition-colors">
                                  <div onClick={() => { const nextStatus = task.status === 'DONE' ? 'NOT STARTED' : 'DONE'; handleUpdateTaskState(task.id, 'status', nextStatus); syncTaskToDB(task.id, 'status', nextStatus); }} className={`w-5 h-5 rounded-md border-2 flex items-center justify-center cursor-pointer transition-all shadow-sm ${task.status === 'DONE' ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 group-hover:border-blue-400 bg-white'}`}>
                                    {task.status === 'DONE' && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                  </div>
                                </td>
                                
                                <td className="py-2.5 px-4 border-r border-slate-200 align-top pt-3.5 sticky left-[48px] z-30 bg-inherit group-hover:bg-slate-50 transition-colors shadow-[4px_0_8px_-4px_rgba(0,0,0,0.05)]">
                                  <div className="flex items-start gap-3 w-full pr-2">
                                    <input value={task.title} onChange={e => handleUpdateTaskState(task.id, 'title', e.target.value)} onBlur={e => syncTaskToDB(task.id, 'title', e.target.value)} placeholder="What needs to be done?" className={`flex-1 bg-transparent outline-none font-semibold placeholder-slate-300 focus:border-b-2 focus:border-blue-400 transition-all ${task.status === 'DONE' ? 'text-slate-400 line-through decoration-1' : 'text-slate-700'}`} />
                                    <button onClick={() => setActiveUpdateTaskId(task.id)} className="relative shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-blue-50 transition-colors group/btn -mt-1">
                                      {tUpdates.length > 0 ? (
                                        <><MessageCircle className="w-5 h-5 text-blue-500 fill-blue-500" /><span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[9px] font-bold px-1.5 rounded-full shadow-sm">{tUpdates.length}</span></>
                                      ) : (
                                        <div className="relative text-slate-300 group-hover/btn:text-blue-500 transition-colors"><MessageCircle className="w-5 h-5" /><Plus className="w-3 h-3 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 stroke-[3]" /></div>
                                      )}
                                    </button>
                                  </div>
                                </td>
                                
                                <td className="py-2.5 px-4 border-r border-slate-200 text-center align-top pt-3.5">
                                  <div className="flex justify-center"><img src={getUser(task.ownerId).avatar} alt="owner" className="w-7 h-7 rounded-full bg-slate-200 border-2 border-white shadow-sm object-cover" title={getUser(task.ownerId).name}/></div>
                                </td>

                                <td className={`p-0 border-r border-slate-200 text-center align-middle cursor-pointer transition-colors ${getStatusColor(task.status)}`} onClick={() => { const nS = cycleStatus(task.status); handleUpdateTaskState(task.id, 'status', nS); syncTaskToDB(task.id, 'status', nS); }}>
                                  <div className="w-full min-h-[48px] flex items-center justify-center font-bold text-xs uppercase tracking-wider text-white">{task.status}</div>
                                </td>

                                <td className="py-2.5 px-4 border-r border-slate-200 align-top pt-3.5">
                                  <input type="date" value={task.dueDate} onChange={e => { handleUpdateTaskState(task.id, 'dueDate', e.target.value); syncTaskToDB(task.id, 'dueDate', e.target.value); }} className={`bg-transparent outline-none font-medium text-sm cursor-pointer w-full transition-all ${task.status === 'DONE' ? 'text-slate-400 line-through opacity-70' : 'text-slate-600'}`} />
                                </td>

                                <td className="py-2.5 px-4 align-top border-r border-slate-200 cursor-pointer" onClick={() => setActiveDescTaskId(task.id)}>
                                  <div className="flex items-start justify-between gap-2 h-full hover:bg-slate-100/50 p-1 -m-1 rounded-lg transition-colors border border-transparent hover:border-slate-200">
                                    <div className="flex flex-col gap-1 w-full overflow-hidden">
                                      {task.description ? <p className="text-xs text-slate-600 truncate">{task.description}</p> : <p className="text-xs text-slate-400 italic">Click to add description...</p>}
                                      {task.descriptionImage && <div className="flex items-center gap-1 text-[10px] text-blue-500 font-bold bg-blue-50 w-max px-2 py-0.5 rounded-full border border-blue-100"><ImagePlus className="w-3 h-3" /> Image attached</div>}
                                    </div>
                                    <FileText className="w-4 h-4 text-slate-300 shrink-0 mt-0.5" />
                                  </div>
                                </td>

                                <td className="py-2 px-4 align-top border-r border-slate-200">
                                  <div className="flex flex-col gap-2 w-full min-w-[200px]">
                                    {tComments.map((comment) => (
                                      <div key={comment.id} className="flex items-start gap-2">
                                        <img src={getUser(comment.userId).avatar} className="w-5 h-5 rounded-full shrink-0 border border-slate-200 mt-0.5 object-cover" title={getUser(comment.userId).name} />
                                        <span className="text-xs text-slate-600 bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg break-words w-full shadow-sm">{comment.text}</span>
                                      </div>
                                    ))}
                                    <input type="text" placeholder={tComments.length > 0 ? "Add another comment..." : "Click to add comment..."} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.value.trim()) { handleAddInlineComment(task.id, e.target.value.trim()); e.target.value = ''; } }} className="bg-transparent outline-none text-xs font-medium text-slate-600 placeholder-slate-300 focus:placeholder-slate-400 w-full px-1 py-1 mt-1 border-b border-transparent focus:border-slate-300 transition-all" />
                                  </div>
                                </td>

                                <td className="py-2.5 px-2 text-center align-top pt-3.5">
                                  <button onClick={() => deleteTask(task.id)} className="text-slate-300 hover:text-rose-500 transition-colors p-1.5 rounded-lg hover:bg-rose-50 opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                                </td>
                              </motion.tr>
                            );
                          })}
                        </AnimatePresence>
                      </tbody>
                    </table>

                    <div onClick={handleAddTask} className="border-t border-slate-200 bg-slate-50/50 hover:bg-blue-50/50 cursor-pointer flex items-center px-4 py-3 text-slate-500 hover:text-blue-600 font-semibold text-sm transition-colors group min-w-[1150px]">
                      <div className="w-[48px] pl-2"><Plus className="w-4 h-4 group-hover:scale-125 transition-transform" /></div> Add Task
                    </div>
                  </div>
                  
                  <div className="bg-[#2b2f3e] px-4 py-3 flex items-center mt-auto min-w-[1150px]">
                    <div className="w-12 min-w-[48px]"></div><div className="w-[350px] min-w-[350px]"></div><div className="w-28 text-center"></div> 
                    <div className="w-40 px-2">
                      <div className="flex h-3 rounded-full overflow-hidden w-full bg-slate-600">
                        {activeTasks.length > 0 && (
                          <><div style={{width: `${(activeTasks.filter(t=>t.status==='DONE').length / activeTasks.length)*100}%`}} className="bg-emerald-500 transition-all"></div><div style={{width: `${(activeTasks.filter(t=>t.status==='WORKING ON IT').length / activeTasks.length)*100}%`}} className="bg-amber-400 transition-all"></div><div style={{width: `${(activeTasks.filter(t=>t.status==='NOT STARTED').length / activeTasks.length)*100}%`}} className="bg-slate-400 transition-all"></div></>
                        )}
                      </div>
                    </div>
                    <div className="w-40 text-center text-xs text-white font-medium bg-slate-700/50 rounded-full px-2 py-1 ml-4 border border-slate-600">{activeProject.startDate.substring(5)} - {activeProject.endDate.substring(5)}</div>
                    <div className="flex-1"></div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-white/40 backdrop-blur-xl border border-white/80 rounded-3xl shadow-sm h-[400px]">
                <div className="text-center text-slate-500 p-8">
                  <CalendarDays className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-slate-700 mb-2">No Projects Found in this Workspace</h3>
                  <p className="text-sm mb-4">Click "+ New" on the sidebar to create the first project for {selectedWorkspaceOwner.name}.</p>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* ================= SIDE PANEL: UPDATES ================= */}
      <AnimatePresence>
        {activeUpdateTaskId && activeTaskForUpdate && (
          <motion.div initial={{ x: '100%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '100%', opacity: 0 }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed right-0 top-0 bottom-0 w-full max-w-[420px] bg-white shadow-[-10px_0_40px_rgba(0,0,0,0.1)] z-50 border-l border-slate-200 flex flex-col">
            <div className="p-5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div className="min-w-0 pr-4"><h3 className="font-extrabold text-lg text-slate-800 truncate">{activeTaskForUpdate.title || 'Untitled Task'}</h3><p className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-1"><MessageCircle className="w-3 h-3" /> Task Updates</p></div>
              <button onClick={() => { setActiveUpdateTaskId(null); setUpdateImageFile(null); setUpdateImagePreview(null); }} className="p-2 text-slate-400 hover:bg-slate-200 rounded-xl"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6 bg-white beautiful-scrollbar">
              {updates.filter(u => u.taskId === activeUpdateTaskId).length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 opacity-60"><MessageCircle className="w-16 h-16 mb-4 stroke-1" /><p className="text-sm font-medium">No updates yet.<br/>Log your first update here!</p></div>
              ) : (
                updates.filter(u => u.taskId === activeUpdateTaskId).map((update) => {
                  const isOwner = currentProfile?.id === update.userId;

                  return (
                    <div key={update.id} className="flex gap-3 group/item relative">
                      <img src={getUser(update.userId).avatar} alt="Avatar" className="w-9 h-9 rounded-full shadow-sm shrink-0 border border-slate-100 mt-1 object-cover" />
                      <div className="flex-1 min-w-0 bg-slate-50 p-4 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm relative">
                        <div className="flex justify-between items-center mb-2 gap-2">
                          <span className="font-bold text-sm text-slate-800 truncate">{getUser(update.userId).name}</span>
                          
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 shrink-0">
                              {new Date(update.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            
                            {isOwner && (
                              <button 
                                type="button" 
                                onClick={() => setUpdateToDelete(update)}
                                className="opacity-0 group-hover/item:opacity-100 text-slate-300 hover:text-rose-500 transition-all p-1 rounded-lg hover:bg-rose-50"
                                title="ลบอัปเดตนี้"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {update.text && <p className="text-sm text-slate-700 whitespace-pre-wrap mb-2">{update.text}</p>}
                        {update.image && (
                          <div className="mt-2 rounded-xl overflow-hidden border border-slate-200 cursor-pointer hover:opacity-90" onClick={() => setPreviewImage(update.image)}>
                            <img src={update.image} alt="attached" className="w-full max-h-48 object-cover" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 bg-white border-t border-slate-200">
              {updateImagePreview && (
                <div className="mb-3 relative w-max">
                  <div className="w-20 h-20 rounded-lg overflow-hidden border-2 border-blue-200 shadow-sm relative"><img src={updateImagePreview} alt="Preview" className="w-full h-full object-cover" /></div>
                  <button onClick={() => { setUpdateImageFile(null); setUpdateImagePreview(null); }} className="absolute -top-2 -right-2 bg-slate-800 text-white rounded-full p-1 hover:bg-rose-500 shadow-md"><X className="w-3 h-3" /></button>
                </div>
              )}
              <form onSubmit={handleAddUpdate} className="flex items-start gap-3">
                <img src={currentProfile.avatar} className="w-9 h-9 rounded-full shrink-0 border border-slate-200 mt-1 object-cover" />
                <div className="flex-1 relative flex bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden focus-within:border-blue-500 focus-within:ring-2 shadow-inner">
                  <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelect} className="hidden" />
                  <button type="button" onClick={() => fileInputRef.current.click()} className="p-3 text-slate-400 hover:text-blue-500 pb-4"><ImagePlus className="w-5 h-5" /></button>
                  <textarea value={updateInput} onChange={e => setUpdateInput(e.target.value)} onKeyDown={e => { if(e.key==='Enter' && !e.shiftKey) handleAddUpdate(e); }} placeholder="Write an update..." className="flex-1 bg-transparent p-3 pl-1 pr-12 text-sm text-slate-700 outline-none resize-none h-[80px] beautiful-scrollbar" />
                  <button type="submit" disabled={!updateInput.trim() && !updateImageFile} className="absolute right-2 bottom-2 p-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"><Send className="w-4 h-4" /></button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= MODAL: DESCRIPTION ================= */}
      <AnimatePresence>
        {activeDescTaskId && activeTaskForDesc && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setActiveDescTaskId(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} onClick={(e) => e.stopPropagation()} className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-3"><div className="p-2 bg-blue-100 text-blue-600 rounded-xl"><FileText className="w-5 h-5" /></div><div><h3 className="font-bold text-slate-800 text-lg">Task Description</h3><p className="text-xs text-slate-500">"{activeTaskForDesc.title || 'Untitled'}"</p></div></div>
                <button onClick={() => setActiveDescTaskId(null)} className="p-2 text-slate-400 hover:bg-slate-200 rounded-xl"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 overflow-y-auto beautiful-scrollbar flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Details & Notes</label>
                  <textarea value={activeTaskForDesc.description} onChange={(e) => handleUpdateTaskState(activeDescTaskId, 'description', e.target.value)} onBlur={(e) => syncTaskToDB(activeDescTaskId, 'description', e.target.value)} placeholder="Add detailed instructions..." className="w-full min-h-[150px] p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-700 outline-none focus:border-blue-400 transition-all resize-y shadow-inner" />
                </div>
                <div className="flex flex-col gap-2 border-t border-slate-100 pt-6">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-500 uppercase">Attached Image</label>
                    <input type="file" id="desc-img" accept="image/*" className="hidden" onChange={handleDescImageUpload} />
                    <label htmlFor="desc-img" className="flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg cursor-pointer"><ImagePlus className="w-3.5 h-3.5" /> {activeTaskForDesc.descriptionImage ? 'Change Image' : 'Upload Image'}</label>
                  </div>
                  {activeTaskForDesc.descriptionImage ? (
                    <div className="relative rounded-2xl overflow-hidden border-2 border-slate-200 group mt-2 bg-slate-50 flex items-center justify-center min-h-[200px]">
                      <img src={activeTaskForDesc.descriptionImage} alt="desc" className="max-h-[300px] w-auto object-contain cursor-pointer" onClick={() => setPreviewImage(activeTaskForDesc.descriptionImage)} />
                      <button onClick={() => { handleUpdateTaskState(activeDescTaskId, 'descriptionImage', null); syncTaskToDB(activeDescTaskId, 'descriptionImage', null); }} className="absolute top-3 right-3 p-2 bg-slate-900/70 text-white rounded-xl opacity-0 group-hover:opacity-100 hover:bg-rose-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ) : (
                    <label htmlFor="desc-img" className="mt-2 border-2 border-dashed border-slate-300 rounded-2xl p-8 flex flex-col items-center justify-center text-slate-400 hover:text-blue-500 cursor-pointer"><ImagePlus className="w-10 h-10 mb-2 opacity-50" /><p className="text-sm font-semibold">Click to upload an image</p></label>
                  )}
                </div>
              </div>
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                <button onClick={() => setActiveDescTaskId(null)} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-sm">Done</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= FULLSCREEN IMAGE PREVIEW ================= */}
      <AnimatePresence>
        {previewImage && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4" onClick={() => setPreviewImage(null)}>
            <button className="absolute top-6 right-6 p-2 text-white/50 hover:text-white bg-white/10 hover:bg-white/20 rounded-full" onClick={() => setPreviewImage(null)}><X className="w-8 h-8" /></button>
            <motion.img initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} src={previewImage} onClick={e => e.stopPropagation()} className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= MODAL: CONFIRM DELETE UPDATE ================= */}
      <AnimatePresence>
        {updateToDelete && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 p-4"
            onClick={() => setUpdateToDelete(null)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 10 }} 
              onClick={(e) => e.stopPropagation()} 
              className="bg-white/95 backdrop-blur-xl border border-white p-6 rounded-3xl shadow-2xl max-w-sm w-full text-center flex flex-col items-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-4 border border-rose-100 shadow-sm">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-800 mb-1">ลบข้อความอัปเดต?</h3>
              <p className="text-xs text-slate-500 font-medium mb-6 leading-relaxed">
                คุณแน่ใจหรือไม่ว่าต้องการลบอัปเดตนี้ ข้อมูลจะถูกลบออกจากระบบทันที
              </p>
              <div className="flex gap-3 w-full">
                <button 
                  type="button" 
                  onClick={() => setUpdateToDelete(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button 
                  type="button" 
                  onClick={confirmDeleteUpdate}
                  className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer"
                >
                  ยืนยันลบ
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= TOAST NOTIFICATIONS ================= */}
      <div className="fixed top-6 right-6 z-[130] flex flex-col gap-3 pointer-events-none max-w-sm w-full">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className="pointer-events-auto bg-white/95 backdrop-blur-xl border border-blue-200/80 shadow-[0_10px_30px_rgba(59,130,246,0.2)] p-4 rounded-2xl flex items-start gap-3 relative overflow-hidden"
            >
              <div className="p-2 bg-blue-500 text-white rounded-xl shadow-sm shrink-0 mt-0.5">
                <Bell className="w-4 h-4 animate-bounce" />
              </div>
              <div className="flex-1 min-w-0 pr-4">
                <h4 className="text-xs font-extrabold text-slate-800 tracking-tight mb-0.5">{toast.title}</h4>
                <p className="text-xs text-slate-600 font-medium truncate">{toast.message}</p>
              </div>
              <button 
                type="button" 
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </AuraBackground>
  );
}