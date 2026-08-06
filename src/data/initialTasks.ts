import { Task } from '../types';

export function getInitialTasks(): Task[] {
  const todayStr = new Date().toISOString().split('T')[0];
  const now = new Date();
  
  // Create morning task time 08:30
  const morningTime = '08:30';
  const midTime = '11:00';
  const afternoonTime = '14:30';
  const eveningTime = '18:00';

  return [
    {
      id: 'task-1',
      title: 'Morning Routine & Hydration',
      description: 'Drink 500ml water, stretch, and map out daily priorities.',
      completed: true,
      completedAt: `${todayStr}T08:45:00.000Z`,
      date: todayStr,
      time: morningTime,
      estimatedMinutes: 20,
      priority: 'high',
      category: 'Health & Fitness',
      subtasks: [
        { id: 'sub-1', title: 'Drink glass of water', completed: true },
        { id: 'sub-2', title: '10 minute mobility stretch', completed: true },
        { id: 'sub-3', title: 'Review today goals', completed: true },
      ],
      recurrence: {
        type: 'daily',
      },
      reminder: {
        enabled: true,
        remindBeforeMinutes: 0,
        sound: 'chime',
      },
      tags: ['Habit', 'Wellness'],
      createdAt: new Date(now.getTime() - 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'task-2',
      title: 'Daily Team Sync & Sprint Check-in',
      description: 'Review project milestones, answer blocking issues, and assign tickets.',
      completed: false,
      date: todayStr,
      time: midTime,
      estimatedMinutes: 30,
      priority: 'urgent',
      category: 'Work',
      subtasks: [
        { id: 'sub-21', title: 'Prepare demo link', completed: true },
        { id: 'sub-22', title: 'Take meeting minutes', completed: false },
      ],
      recurrence: {
        type: 'weekdays',
      },
      reminder: {
        enabled: true,
        remindBeforeMinutes: 5,
        sound: 'bell',
      },
      tags: ['Meeting', 'Urgent'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'task-3',
      title: 'Deep Work: Core Feature Implementation',
      description: 'Spend uninterrupted focus time building core task components.',
      completed: false,
      date: todayStr,
      time: afternoonTime,
      estimatedMinutes: 60,
      priority: 'high',
      category: 'Work',
      subtasks: [
        { id: 'sub-31', title: 'Build responsive task cards', completed: false },
        { id: 'sub-32', title: 'Configure recurring reminder engine', completed: false },
      ],
      recurrence: {
        type: 'none',
      },
      reminder: {
        enabled: true,
        remindBeforeMinutes: 15,
        sound: 'gentle',
      },
      tags: ['Focus', 'Code'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'task-4',
      title: '30 Min Fitness & Walk Break',
      description: 'Get fresh air outside and reach daily step target.',
      completed: false,
      date: todayStr,
      time: eveningTime,
      estimatedMinutes: 30,
      priority: 'medium',
      category: 'Health & Fitness',
      subtasks: [],
      recurrence: {
        type: 'daily',
      },
      reminder: {
        enabled: true,
        remindBeforeMinutes: 0,
        sound: 'voice',
      },
      tags: ['Exercise', 'Outdoors'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'task-5',
      title: 'Read 15 Pages of Book',
      description: 'Quiet evening reading session before sleep.',
      completed: false,
      date: todayStr,
      time: '20:30',
      estimatedMinutes: 25,
      priority: 'low',
      category: 'Study & Learning',
      subtasks: [],
      recurrence: {
        type: 'daily',
      },
      reminder: {
        enabled: true,
        remindBeforeMinutes: 10,
        sound: 'chime',
      },
      tags: ['Reading', 'Night Routine'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
}
