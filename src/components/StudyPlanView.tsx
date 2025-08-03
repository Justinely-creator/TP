import React, { useState, useMemo } from 'react';
import { Calendar, Clock, BookOpen, AlertTriangle, CheckCircle2, RotateCcw, Play, Edit, Save, X, Lock, Unlock, Trash2, SkipForward, RefreshCw, Lightbulb, Target, TrendingUp, Users, Settings as SettingsIcon } from 'lucide-react';
import { StudyPlan, StudySession, Task, FixedCommitment, UserSettings } from '../types';
import { formatTime, checkSessionStatus, getLocalDateString } from '../utils/scheduling';
import SuggestionsPanel from './SuggestionsPanel';

interface StudyPlanViewProps {
  studyPlans: StudyPlan[];
  tasks: Task[];
  fixedCommitments: FixedCommitment[];
  settings: UserSettings;
  onGenerateStudyPlan: () => void;
  onSelectTask: (task: Task, session?: { allocatedHours: number; planDate?: string; sessionNumber?: number }) => void;
  onMarkSessionDone: (planDate: string, sessionNumber: number) => void;
  onSkipSession: (planDate: string, sessionNumber: number, taskId: string) => void;
  onRedistributeMissedSessions: (mode: 'enhanced' | 'legacy') => void;
  onRescheduleSession: (planDate: string, sessionNumber: number, taskId: string, newStartTime: string) => void;
  onToggleDayLock: (planDate: string) => void;
  onDeleteSession: (planDate: string, sessionNumber: number, taskId: string) => void;
  onUpdateSettings?: (updates: Partial<UserSettings>) => void;
  onUpdateTask?: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask?: (taskId: string) => void;
}

const StudyPlanView: React.FC<StudyPlanViewProps> = ({
  studyPlans,
  tasks,
  fixedCommitments,
  settings,
  onGenerateStudyPlan,
  onSelectTask,
  onMarkSessionDone,
  onSkipSession,
  onRedistributeMissedSessions,
  onRescheduleSession,
  onToggleDayLock,
  onDeleteSession,
  onUpdateSettings,
  onUpdateTask,
  onDeleteTask
}) => {
  const [editingSession, setEditingSession] = useState<{
    planDate: string;
    sessionNumber: number;
    taskId: string;
  } | null>(null);
  const [newStartTime, setNewStartTime] = useState('');

  const today = getLocalDateString();

  // Calculate missed sessions for redistribution
  const missedSessions = useMemo(() => {
    const missed: Array<{ session: StudySession; planDate: string; task: Task }> = [];
    
    studyPlans.forEach(plan => {
      if (plan.date < today) {
        plan.plannedTasks.forEach(session => {
          const sessionStatus = checkSessionStatus(session, plan.date);
          if (sessionStatus === 'missed') {
            const task = tasks.find(t => t.id === session.taskId);
            if (task && task.status === 'pending') {
              missed.push({ session, planDate: plan.date, task });
            }
          }
        });
      }
    });
    
    return missed;
  }, [studyPlans, tasks, today]);

  // Calculate total unscheduled hours
  const unscheduledHours = useMemo(() => {
    const taskScheduledHours: Record<string, number> = {};
    
    studyPlans.forEach(plan => {
      plan.plannedTasks.forEach(session => {
        if (session.status !== 'skipped') {
          taskScheduledHours[session.taskId] = (taskScheduledHours[session.taskId] || 0) + session.allocatedHours;
        }
      });
    });

    return tasks
      .filter(task => task.status === 'pending')
      .reduce((total, task) => {
        const scheduled = taskScheduledHours[task.id] || 0;
        const unscheduled = Math.max(0, task.estimatedHours - scheduled);
        return total + unscheduled;
      }, 0);
  }, [studyPlans, tasks]);

  const handleEditSession = (planDate: string, sessionNumber: number, taskId: string, currentStartTime: string) => {
    setEditingSession({ planDate, sessionNumber, taskId });
    setNewStartTime(currentStartTime);
  };

  const handleSaveEdit = () => {
    if (editingSession && newStartTime) {
      onRescheduleSession(
        editingSession.planDate,
        editingSession.sessionNumber,
        editingSession.taskId,
        newStartTime
      );
      setEditingSession(null);
      setNewStartTime('');
    }
  };

  const handleCancelEdit = () => {
    setEditingSession(null);
    setNewStartTime('');
  };

  const getSessionStatusColor = (session: StudySession, planDate: string) => {
    const status = checkSessionStatus(session, planDate);
    
    if (session.done || session.status === 'completed') {
      return 'bg-green-100 border-green-300 text-green-800 dark:bg-green-900/20 dark:border-green-700 dark:text-green-300';
    }
    
    if (session.status === 'skipped') {
      return 'bg-yellow-100 border-yellow-300 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-700 dark:text-yellow-300';
    }
    
    switch (status) {
      case 'missed':
        return 'bg-red-100 border-red-300 text-red-800 dark:bg-red-900/20 dark:border-red-700 dark:text-red-300';
      case 'overdue':
        return 'bg-orange-100 border-orange-300 text-orange-800 dark:bg-orange-900/20 dark:border-orange-700 dark:text-orange-300';
      default:
        return session.isManualOverride 
          ? 'bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-300'
          : 'bg-gray-50 border-gray-200 text-gray-800 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200';
    }
  };

  const getSessionStatusIcon = (session: StudySession, planDate: string) => {
    const status = checkSessionStatus(session, planDate);
    
    if (session.done || session.status === 'completed') {
      return <CheckCircle2 className="text-green-600 dark:text-green-400" size={16} />;
    }
    
    if (session.status === 'skipped') {
      return <SkipForward className="text-yellow-600 dark:text-yellow-400" size={16} />;
    }
    
    switch (status) {
      case 'missed':
        return <AlertTriangle className="text-red-600 dark:text-red-400" size={16} />;
      case 'overdue':
        return <Clock className="text-orange-600 dark:text-orange-400" size={16} />;
      default:
        return session.isManualOverride 
          ? <Edit className="text-blue-600 dark:text-blue-400" size={16} />
          : <BookOpen className="text-gray-600 dark:text-gray-400" size={16} />;
    }
  };

  const getSessionStatusText = (session: StudySession, planDate: string) => {
    const status = checkSessionStatus(session, planDate);
    
    if (session.done || session.status === 'completed') return 'Completed';
    if (session.status === 'skipped') return 'Skipped';
    
    switch (status) {
      case 'missed': return 'Missed';
      case 'overdue': return 'Overdue';
      default: return session.isManualOverride ? 'Rescheduled' : 'Scheduled';
    }
  };

  // Sort study plans by date
  const sortedPlans = [...studyPlans].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-6">
      {/* Header with Generate Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Calendar className="text-blue-600 dark:text-blue-400" size={28} />
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Study Plan</h1>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Your personalized study schedule
            </p>
          </div>
        </div>
        
        <button
          onClick={onGenerateStudyPlan}
          className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-200 flex items-center space-x-2 shadow-lg hover:shadow-xl"
        >
          <RefreshCw size={20} />
          <span className="font-medium">Generate Study Plan</span>
        </button>
      </div>

      {/* Suggestions Panel */}
      <SuggestionsPanel
        tasks={tasks}
        studyPlans={studyPlans}
        settings={settings}
        fixedCommitments={fixedCommitments}
        onUpdateSettings={onUpdateSettings}
        onUpdateTask={onUpdateTask}
        onDeleteTask={onDeleteTask}
      />

      {/* Missed Sessions Alert */}
      {missedSessions.length > 0 && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl p-6 dark:from-red-900/20 dark:to-orange-900/20 dark:border-red-700">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="text-red-600 dark:text-red-400 mt-1" size={24} />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
                Missed Sessions Detected
              </h3>
              <p className="text-red-700 dark:text-red-300 mb-4">
                You have {missedSessions.length} missed session{missedSessions.length > 1 ? 's' : ''} that need to be redistributed or skipped.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => onRedistributeMissedSessions('enhanced')}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                >
                  <RotateCcw size={16} />
                  <span>Redistribute (Enhanced)</span>
                </button>
                <button
                  onClick={() => onRedistributeMissedSessions('legacy')}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                >
                  <RotateCcw size={16} />
                  <span>Redistribute (Legacy)</span>
                </button>
              </div>
              
              <div className="mt-3 text-sm text-red-600 dark:text-red-400">
                <p><strong>Enhanced:</strong> Smart priority-based redistribution with conflict detection</p>
                <p><strong>Legacy:</strong> Simple redistribution for compatibility</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Study Plans */}
      {sortedPlans.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📅</div>
          <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">No Study Plan Yet</h3>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            Generate your first study plan to see your personalized schedule!
          </p>
          <button
            onClick={onGenerateStudyPlan}
            className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-3 rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-200 flex items-center space-x-2 mx-auto shadow-lg"
          >
            <Calendar size={20} />
            <span className="font-medium">Create Study Plan</span>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedPlans.map((plan) => {
            const planDate = new Date(plan.date);
            const isToday = plan.date === today;
            const isPast = plan.date < today;
            const dayName = planDate.toLocaleDateString('en-US', { weekday: 'long' });
            const dateDisplay = planDate.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric',
              year: planDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
            });

            // Filter out skipped sessions for display
            const visibleSessions = plan.plannedTasks.filter(session => session.status !== 'skipped');
            const totalVisibleHours = visibleSessions.reduce((sum, session) => sum + session.allocatedHours, 0);

            return (
              <div
                key={plan.id}
                className={`bg-white rounded-xl shadow-lg border-2 transition-all duration-200 dark:bg-gray-900 dark:shadow-gray-900 ${
                  isToday 
                    ? 'border-blue-400 shadow-blue-100 dark:border-blue-600 dark:shadow-blue-900/20' 
                    : 'border-gray-200 dark:border-gray-700'
                } ${isPast ? 'opacity-90' : ''}`}
              >
                {/* Plan Header */}
                <div className={`p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700 ${
                  isToday ? 'bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20' : ''
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${
                        isToday 
                          ? 'bg-blue-500 text-white' 
                          : isPast 
                            ? 'bg-gray-400 text-white' 
                            : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        <Calendar size={20} />
                      </div>
                      <div>
                        <h2 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-white">
                          {dayName}
                          {isToday && <span className="ml-2 text-blue-600 dark:text-blue-400">(Today)</span>}
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {dateDisplay} • {formatTime(totalVisibleHours)} planned
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {/* Lock/Unlock Button */}
                      <button
                        onClick={() => onToggleDayLock(plan.date)}
                        className={`p-2 rounded-lg transition-colors ${
                          plan.isLocked
                            ? 'bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-gray-600'
                        }`}
                        title={plan.isLocked ? 'Unlock day for editing' : 'Lock day to prevent changes'}
                      >
                        {plan.isLocked ? <Lock size={16} /> : <Unlock size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Sessions */}
                <div className="p-4 sm:p-6">
                  {visibleSessions.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-3">📚</div>
                      <p className="text-gray-600 dark:text-gray-300">No sessions planned for this day</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {visibleSessions.map((session) => {
                        const task = tasks.find(t => t.id === session.taskId);
                        if (!task) return null;

                        const isEditing = editingSession?.planDate === plan.date && 
                                         editingSession?.sessionNumber === session.sessionNumber &&
                                         editingSession?.taskId === session.taskId;
                        
                        const sessionStatus = checkSessionStatus(session, plan.date);
                        const isDone = session.done || session.status === 'completed';
                        const canEdit = !plan.isLocked && !isDone && sessionStatus !== 'missed';

                        return (
                          <div
                            key={`${session.taskId}-${session.sessionNumber}`}
                            className={`p-4 rounded-lg border-2 transition-all duration-200 ${getSessionStatusColor(session, plan.date)}`}
                          >
                            {isEditing ? (
                              /* Edit Mode */
                              <div className="space-y-3">
                                <div className="flex items-center space-x-2">
                                  <BookOpen size={16} />
                                  <span className="font-medium">{task.title}</span>
                                </div>
                                
                                <div className="flex items-center space-x-3">
                                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Start Time:
                                  </label>
                                  <input
                                    type="time"
                                    value={newStartTime}
                                    onChange={(e) => setNewStartTime(e.target.value)}
                                    className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                  />
                                  <span className="text-sm text-gray-600 dark:text-gray-400">
                                    Duration: {formatTime(session.allocatedHours)}
                                  </span>
                                </div>
                                
                                <div className="flex space-x-2">
                                  <button
                                    onClick={handleSaveEdit}
                                    className="flex items-center space-x-1 bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg transition-colors text-sm"
                                  >
                                    <Save size={14} />
                                    <span>Save</span>
                                  </button>
                                  <button
                                    onClick={handleCancelEdit}
                                    className="flex items-center space-x-1 bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded-lg transition-colors text-sm"
                                  >
                                    <X size={14} />
                                    <span>Cancel</span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* Display Mode */
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3 flex-1 min-w-0">
                                  {getSessionStatusIcon(session, plan.date)}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center space-x-2 mb-1">
                                      <h3 className={`font-medium truncate ${
                                        isDone ? 'line-through text-gray-500 dark:text-gray-400' : ''
                                      }`}>
                                        {task.title}
                                      </h3>
                                      {task.category && (
                                        <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full dark:bg-gray-700 dark:text-gray-300">
                                          {task.category}
                                        </span>
                                      )}
                                      {task.importance && (
                                        <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full dark:bg-red-900 dark:text-red-200">
                                          Important
                                        </span>
                                      )}
                                    </div>
                                    
                                    <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-300">
                                      <div className="flex items-center space-x-1">
                                        <Clock size={14} />
                                        <span>{session.startTime} - {session.endTime}</span>
                                      </div>
                                      <div className="flex items-center space-x-1">
                                        <Target size={14} />
                                        <span>{formatTime(session.allocatedHours)}</span>
                                      </div>
                                      <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                                        {getSessionStatusText(session, plan.date)}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center space-x-1 ml-3">
                                  {!isDone && sessionStatus !== 'missed' && (
                                    <button
                                      onClick={() => onSelectTask(task, {
                                        allocatedHours: session.allocatedHours,
                                        planDate: plan.date,
                                        sessionNumber: session.sessionNumber
                                      })}
                                      className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-colors dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/20"
                                      title="Start session"
                                    >
                                      <Play size={16} />
                                    </button>
                                  )}
                                  
                                  {!isDone && sessionStatus !== 'missed' && (
                                    <button
                                      onClick={() => onMarkSessionDone(plan.date, session.sessionNumber || 0)}
                                      className="p-2 text-green-600 hover:text-green-800 hover:bg-green-100 rounded-lg transition-colors dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-900/20"
                                      title="Mark as done"
                                    >
                                      <CheckCircle2 size={16} />
                                    </button>
                                  )}

                                  {/* Edit Button - Updated Logic */}
                                  {canEdit ? (
                                    <button
                                      onClick={() => handleEditSession(plan.date, session.sessionNumber || 0, session.taskId, session.startTime)}
                                      className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-700"
                                      title="Edit session time"
                                    >
                                      <Edit size={16} />
                                    </button>
                                  ) : plan.isLocked ? (
                                    <button
                                      disabled
                                      className="p-2 text-gray-300 cursor-not-allowed dark:text-gray-600"
                                      title="Day is locked - unlock to edit"
                                    >
                                      <Lock size={16} />
                                    </button>
                                  ) : (
                                    <button
                                      disabled
                                      className="p-2 text-gray-300 cursor-not-allowed dark:text-gray-600"
                                      title="Cannot edit completed or missed sessions"
                                    >
                                      <Edit size={16} />
                                    </button>
                                  )}

                                  {!isDone && (
                                    <button
                                      onClick={() => onSkipSession(plan.date, session.sessionNumber || 0, session.taskId)}
                                      className="p-2 text-yellow-600 hover:text-yellow-800 hover:bg-yellow-100 rounded-lg transition-colors dark:text-yellow-400 dark:hover:text-yellow-300 dark:hover:bg-yellow-900/20"
                                      title="Skip session"
                                    >
                                      <SkipForward size={16} />
                                    </button>
                                  )}

                                  {!plan.isLocked && (
                                    <button
                                      onClick={() => onDeleteSession(plan.date, session.sessionNumber || 0, session.taskId)}
                                      className="p-2 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-lg transition-colors dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
                                      title="Delete session"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary Stats */}
      {sortedPlans.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-200 dark:from-blue-900/20 dark:to-purple-900/20 dark:border-blue-700">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center space-x-2">
            <TrendingUp className="text-blue-600 dark:text-blue-400" size={20} />
            <span>Study Plan Summary</span>
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {sortedPlans.reduce((sum, plan) => 
                  sum + plan.plannedTasks.filter(s => s.status !== 'skipped').length, 0
                )}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">Total Sessions</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {formatTime(sortedPlans.reduce((sum, plan) => 
                  sum + plan.plannedTasks
                    .filter(s => s.status !== 'skipped')
                    .reduce((planSum, session) => planSum + session.allocatedHours, 0), 0
                ))}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">Total Study Time</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {sortedPlans.reduce((sum, plan) => 
                  sum + plan.plannedTasks.filter(s => s.done || s.status === 'completed').length, 0
                )}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-300">Completed Sessions</div>
            </div>
          </div>

          {unscheduledHours > 0 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg dark:bg-yellow-900/20 dark:border-yellow-700">
              <div className="flex items-center space-x-2">
                <Lightbulb className="text-yellow-600 dark:text-yellow-400" size={16} />
                <span className="text-sm text-yellow-700 dark:text-yellow-300">
                  <strong>{formatTime(unscheduledHours)}</strong> of work couldn't be scheduled. 
                  Consider adjusting your settings or deadlines.
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StudyPlanView;