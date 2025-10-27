import './App.css';

import { useEffect, useState, useCallback } from 'react';
import { ChartContainer, type ChartConfig } from './components/ui/chart';
import {
  Label as ChartLabel,
  PolarGrid,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
} from 'recharts';
// import backgroundImage from '@/assets/background.webp';
import { Button } from './components/ui/button';
import { Settings } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './components/ui/dialog';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import leafImage from '@/assets/leaf.png';

function App() {
  const [time, setTime] = useState(() => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [hackatimeApiKey, setHackatimeApiKey] = useState(() => {
    return localStorage.getItem('hackatimeApiKey') || '';
  });
  const [githubUsername, setGithubUsername] = useState(() => {
    return localStorage.getItem('githubUsername') || '';
  });
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [goalHours, setGoalHours] = useState(() => {
    const saved = localStorage.getItem('goalHours');
    return saved ? parseFloat(saved) : 3;
  });
  const [selectedRepo, setSelectedRepo] = useState(() => {
    return localStorage.getItem('selectedRepo') || '';
  });
  const [repoLanguages, setRepoLanguages] = useState<{ name: string; percentage: string; }[]>([]);
  const [userRepos, setUserRepos] = useState<{ name: string; fullName: string; }[]>([]);
  const [isRepoDialogOpen, setIsRepoDialogOpen] = useState(false);
  const [githubStats, setGithubStats] = useState<{
    todayCommits: number;
    currentStreak: number;
    totalContributions: number;
  } | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem('hackatimeApiKey', hackatimeApiKey);
  }, [hackatimeApiKey]);

  useEffect(() => {
    localStorage.setItem('githubUsername', githubUsername);
  }, [githubUsername]);

  useEffect(() => {
    localStorage.setItem('goalHours', goalHours.toString());
  }, [goalHours]);

  useEffect(() => {
    localStorage.setItem('selectedRepo', selectedRepo);
  }, [selectedRepo]);

  const fetchHackatimeData = useCallback(async () => {
    if (!hackatimeApiKey) return;
    
    try {
      const statusResponse = await fetch(
        `https://hackatime.hackclub.com/api/hackatime/v1/users/current/statusbar/today?api_key=${hackatimeApiKey}`
      );
      const statusData = await statusResponse.json();
      if (statusData?.data?.grand_total?.total_seconds !== undefined) {
        setTotalSeconds(statusData.data.grand_total.total_seconds);
      }
    } catch (error) {
      console.error('Error fetching Hackatime data:', error);
    }
  }, [hackatimeApiKey]);

  const fetchGithubStats = useCallback(async () => {
    if (!githubUsername) return;
    
    try {
      const eventsResponse = await fetch(
        `https://api.github.com/users/${githubUsername}/events`
      );
      const events = await eventsResponse.json();
      
      // Genuinly don't know why everything is a type any here... I can't figure out how to fix it either
      const today = new Date().toDateString();
      const todayCommits = events.filter((event: any) => 
        event.type === 'PushEvent' && 
        new Date(event.created_at).toDateString() === today
      ).reduce((sum: number, event: any) => 
        sum + (event.payload.commits?.length || 0), 0
      );

      const recentDays = new Set(
        events
          .filter((event: any) => event.type === 'PushEvent')
          .map((event: any) => new Date(event.created_at).toDateString())
      );
      
      setGithubStats({
        todayCommits,
        currentStreak: recentDays.size,
        totalContributions: events.filter((e: any) => e.type === 'PushEvent').length,
      });
    } catch (error) {
      console.error('Error fetching GitHub data:', error);
    }
  }, [githubUsername]);

  const fetchUserRepos = useCallback(async () => {
    if (!githubUsername) return;
    
    try {
      const response = await fetch(
        `https://api.github.com/users/${githubUsername}/repos?sort=updated&per_page=30`
      );
      const repos = await response.json();
      setUserRepos(repos.map((repo: any) => ({ name: repo.name, fullName: repo.full_name })));
    } catch (error) {
      console.error('Error fetching repos:', error);
    }
  }, [githubUsername]);

  const fetchRepoLanguages = useCallback(async () => {
    if (!selectedRepo || !githubUsername) return;
    
    try {
      const response = await fetch(
        `https://api.github.com/repos/${githubUsername}/${selectedRepo}/languages`
      );
      const languages = await response.json();
      
      const total = Object.values(languages).reduce((sum: number, bytes: any) => sum + bytes, 0);
      const percentages = Object.entries(languages).map(([name, bytes]: [string, any]) => ({
        name,
        percentage: ((bytes / total) * 100).toFixed(1)
      }));
      
      setRepoLanguages(percentages);
    } catch (error) {
      console.error('Error fetching repo languages:', error);
    }
  }, [selectedRepo, githubUsername]);

  // Fetch on key change
  useEffect(() => {
    fetchHackatimeData();
  }, [fetchHackatimeData]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchHackatimeData();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchHackatimeData]);

  // Fetch stats on username change
  useEffect(() => {
    fetchGithubStats();
  }, [fetchGithubStats]);

  useEffect(() => {
    fetchUserRepos();
  }, [fetchUserRepos]);

  useEffect(() => {
    fetchRepoLanguages();
  }, [fetchRepoLanguages]);

  const chartConfig = {
    hours: {
      label: 'Hours',
    },
    safari: {
      label: 'Safari',
      color: 'var(--chart-3)',
    },
  } satisfies ChartConfig;

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const goalSeconds = goalHours * 3600;
  const percentage = Math.min((totalSeconds / goalSeconds), 1);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    if (hour < 21) return 'Good Evening';
    return 'Good Night';
  };

  const chartData = [
    { 
      browser: 'safari', 
      hours: percentage, 
      fill: percentage >= 1 ? 'url(#rainbowGradient)' : 'var(--color-safari)' 
    },
  ];
  return (
    <div
      className="dark bg-gray-800 min-h-screen bg-cover bg-center bg-no-repeat relative overflow-hidden"
      // style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      <div className="fixed inset-0 pointer-events-none z-0">
        {[...Array(Math.round(percentage*100))].map((_, i) => (
          <img
            key={i}
            src={leafImage}
            alt=""
            className="absolute w-8 h-8 opacity-0"
            style={{
              left: `${Math.random() * 100}%`,
              top: '-10vh',
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${15 + Math.random() * 10}s`,
              animation: 'fall linear infinite',
            }}
          />
        ))}
      </div>

      <div className="absolute top-0 left-0 m-24 backdrop-blur-sm bg-gray-900/20 p-6 rounded-2xl border border-gray-700/50 shadow-xl">
        <div className="flex flex-col">
          <span className="font-roboto text-sm text-muted-foreground mb-1">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </span>
          <span className="font-roboto font-extrabold text-orange-400 text-5xl drop-shadow-lg">
            {time}
          </span>
        </div>
      </div>

      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
        <h1 className="font-roboto font-bold text-6xl text-foreground mb-2 drop-shadow-2xl">
          {getGreeting()}
        </h1>
        <p className="font-roboto text-xl text-muted-foreground drop-shadow-lg">
          Ready to lock in?
        </p>
      </div>

      <div className="absolute top-0 right-0 m-24 backdrop-blur-sm bg-gray-900/20 p-6 rounded-2xl border border-gray-700/50 shadow-2xl">
        <ChartContainer
          config={chartConfig}
          className="aspect-square w-[250px] h-[250px]"
        >
          <RadialBarChart
            data={chartData}
            endAngle={percentage * 360}
            innerRadius={80}
            outerRadius={100}
          >
            <defs>
              <linearGradient id="rainbowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ff0000">
                  <animate attributeName="stop-color" values="#ff0000;#ff7f00;#ffff00;#00ff00;#0000ff;#8b00ff;#ff0000" dur="3s" repeatCount="indefinite" />
                </stop>
                <stop offset="50%" stopColor="#00ff00">
                  <animate attributeName="stop-color" values="#00ff00;#0000ff;#8b00ff;#ff0000;#ff7f00;#ffff00;#00ff00" dur="3s" repeatCount="indefinite" />
                </stop>
                <stop offset="100%" stopColor="#0000ff">
                  <animate attributeName="stop-color" values="#0000ff;#8b00ff;#ff0000;#ff7f00;#ffff00;#00ff00;#0000ff" dur="3s" repeatCount="indefinite" />
                </stop>
              </linearGradient>
            </defs>
            <PolarGrid
              gridType="circle"
              radialLines={false}
              stroke="none"
              className="first:fill-muted last:fill-background"
              polarRadius={[86, 74]}
            />
            <RadialBar dataKey="hours" background />
            <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
              <ChartLabel
                content={({ viewBox }) => {
                  if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className={`text-4xl font-bold ${percentage >= 1 ? 'fill-orange-400' : 'fill-foreground'}`}
                          style={percentage >= 1 ? {
                            animation: 'rainbow 3s linear infinite',
                            filter: 'drop-shadow(0 0 8px currentColor) drop-shadow(0 0 16px currentColor)',
                          } : undefined}
                        >
                          {formatTime(totalSeconds)}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 24}
                          className="fill-muted-foreground"
                        >
                          Today
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </PolarRadiusAxis>
          </RadialBarChart>
        </ChartContainer>
      </div>

      {githubStats && githubUsername && (
        <div className="absolute bottom-0 left-0 m-12">
          <div className="backdrop-blur-sm bg-gray-900/20 border border-gray-700/50 rounded-2xl p-6 space-y-3 min-w-[280px] shadow-xl">
            <h3 className="font-roboto font-bold text-xl text-foreground mb-4">
              GitHub Stats
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center p-2 rounded hover:bg-gray-800/50 transition-colors duration-200">
                <span className="text-muted-foreground text-sm">Today's Commits</span>
                <span className="font-roboto font-semibold text-orange-400 text-lg">
                  {githubStats.todayCommits}
                </span>
              </div>
              <div className="flex justify-between items-center p-2 rounded hover:bg-gray-800/50 transition-colors duration-200">
                <span className="text-muted-foreground text-sm">Active Days</span>
                <span className="font-roboto font-semibold text-foreground">
                  {githubStats.currentStreak}
                </span>
              </div>
              <div className="flex justify-between items-center p-2 rounded hover:bg-gray-800/50 transition-colors duration-200">
                <span className="text-muted-foreground text-sm">Recent Commits</span>
                <span className="font-roboto font-semibold text-foreground">
                  {githubStats.totalContributions}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {githubUsername && (
        <div className="absolute bottom-0 right-0 m-12 mr-32">
          <div 
            className="backdrop-blur-sm bg-gray-900/20 border border-gray-700/50 rounded-2xl p-6 space-y-3 min-w-[280px] shadow-xl transition-all duration-300 cursor-pointer"
            onClick={() => setIsRepoDialogOpen(true)}
          >
            <h3 className="font-roboto font-bold text-xl text-foreground mb-4">
              Current Project
            </h3>
            <div className="space-y-2">
              <div className="flex flex-col items-start p-2 rounded hover:bg-gray-800/50 transition-colors duration-200">
                <span className="text-muted-foreground text-sm mb-1">Repository</span>
                <span className={`font-roboto font-semibold text-lg ${selectedRepo ? 'text-orange-400' : 'text-muted-foreground/50 italic'}`}>
                  {selectedRepo || 'No repo selected'}
                </span>
              </div>
              {repoLanguages.length > 0 ? (
                <div className="space-y-1 mt-3">
                  <span className="text-muted-foreground text-xs">Languages</span>
                  {repoLanguages.map((lang) => (
                    <div key={lang.name} className="flex justify-between items-center p-2 rounded hover:bg-gray-800/50 transition-colors duration-200">
                      <span className="text-muted-foreground text-sm">{lang.name}</span>
                      <span className="font-roboto font-semibold text-foreground">
                        {lang.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-1 mt-3">
                  <span className="text-muted-foreground text-xs">Languages</span>
                  <div className="flex justify-between items-center p-2 rounded">
                    <span className="text-muted-foreground/50 text-sm italic">Click to select a project</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Dialog open={isRepoDialogOpen} onOpenChange={setIsRepoDialogOpen}>
        <DialogContent className="backdrop-blur-sm bg-gray-900/95 border-gray-700/50">
          <DialogHeader>
            <DialogTitle className="text-gray-200 font-roboto">Select Project</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Choose the GitHub repository you're currently working on
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {userRepos.map((repo) => (
              <div
                key={repo.name}
                className="p-3 rounded-lg border border-gray-700/50 hover:bg-gray-800/50 cursor-pointer transition-colors duration-200"
                onClick={() => {
                  setSelectedRepo(repo.name);
                  setIsRepoDialogOpen(false);
                }}
              >
                <span className="font-roboto text-gray-200">{repo.name}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <div className="absolute bottom-0 right-0 m-12">
        <Button
          variant="ghost"
          size="icon"
          className="text-foreground hover:text-foreground cursor-pointer h-12 w-12 hover:bg-gray-800/50 transition-all duration-200 hover:scale-110 rounded-xl shadow-lg"
          onClick={() => setIsSettingsOpen(true)}
        >
          <Settings className="h-8 w-8" />
        </Button>
      </div>

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="dark bg-gray-900 text-foreground border-gray-700 shadow-2xl">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Configure your dashboard settings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="hackatime-api-key">Hackatime API Key</Label>
              <Input
                id="hackatime-api-key"
                type="password"
                placeholder="Enter your Hackatime API Key"
                value={hackatimeApiKey}
                onChange={(e) => setHackatimeApiKey(e.target.value)}
                className="bg-gray-800 border-gray-700 text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="github-username">GitHub Username</Label>
              <Input
                id="github-username"
                placeholder="Enter your GitHub username"
                value={githubUsername}
                onChange={(e) => setGithubUsername(e.target.value)}
                className="bg-gray-800 border-gray-700 text-foreground"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-hours">Daily Goal (hours)</Label>
              <Input
                id="goal-hours"
                type="number"
                placeholder="Enter your daily goal in hours"
                value={goalHours}
                onChange={(e) => setGoalHours(parseFloat(e.target.value) || 3)}
                className="bg-gray-800 border-gray-700 text-foreground"
                min="0"
                step="0.5"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default App;
