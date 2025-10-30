"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Maximize, Plus, Play, Pause, RotateCcw, Clock, AlignVerticalJustifyCenter, Download, MoreHorizontal, Sun, Moon, Type, FileText, Eraser, Folder as FolderIcon, FolderOpen as FolderOpenIcon, Minimize, FolderPlus, FilePlus, Command, Trash2 } from "lucide-react"
import { useTheme } from "next-themes"
import { useToast } from "@/components/ui/use-toast"
import { exportToFile } from "@/lib/exportUtils"
import { Tree, Folder, File } from "@/components/magicui/file-tree"
import { Kalam } from 'next/font/google';
import { type TreeViewElement } from "@/components/magicui/file-tree";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const kalam = Kalam({
  subsets: ['latin'],
  weight: ["400", "700"],
  variable: '--font-kalam',
});

interface WritingSession {
  id: string
  content: string
  date: string
  timestamp: number
  wordCount: number
  charCount: number
  duration: number
  title?: string
  isNoDeleteMode?: boolean
  paperStyle?: string
}

const INITIAL_CONTENT = ``;
const initialFiles: TreeViewElement[] = [
  {
    id: "1",
    name: "Projects",
    children: [
      {
        id: "2",
        name: "example.txt",
        children: [],
      },
    ],
  },
];
const initialContents = {
  "2": "This is the content of example.txt"
};

export default function WritingApp() {
  const [content, setContent] = useState(INITIAL_CONTENT)
  const [fontSize, setFontSize] = useState("20")
  const [fontFamily, setFontFamily] = useState("system")
  const [paperStyle, setPaperStyle] = useState("default")
  const [timeLeft, setTimeLeft] = useState(15 * 60)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [timerManuallyPaused, setTimerManuallyPaused] = useState(false)

  const [wordCount, setWordCount] = useState(0)
  const [charCount, setCharCount] = useState(0)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const [sessions, setSessions] = useState<WritingSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [showSessionTooltip, setShowSessionTooltip] = useState<string | null>(null)
  const { theme, setTheme } = useTheme()
  const [wpm, setWpm] = useState(0)
  const [isTypewriterMode, setIsTypewriterMode] = useState(false)
  const { toast } = useToast()
  const [isNoDeleteMode, setIsNoDeleteMode] = useState(true)
  const [isShaking, setIsShaking] = useState(false)

  // Store the initial content length to detect if text is being replaced
  const [initialContentLength, setInitialContentLength] = useState(0);

  // State for the file tree data
  const [fileTreeElements, setFileTreeElements] = useState<any[]>([]);

  const [isClient, setIsClient] = useState(false)
  const [distractionFree, setDistractionFree] = useState(false);
  const [files, setFiles] = useState(initialFiles);
  const [fileContents, setFileContents] = useState<{ [key: string]: string }>(initialContents);
  const [selectedId, setSelectedId] = useState<string | undefined>("2");
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);
  const [fileToRename, setFileToRename] = useState<string | null>(null);
  const [isFilesDialogOpen, setIsFilesDialogOpen] = useState(false);
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);

  // Keyboard shortcut for opening files dialog (Cmd/Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsFilesDialogOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load content from localStorage on mount
  useEffect(() => {
    setIsClient(true)
    const savedContent = localStorage.getItem('flow-write-content');
    if (savedContent) {
      setContent(savedContent);
    }
    const savedFiles = localStorage.getItem('flow-write-files');
    if (savedFiles) {
      setFiles(JSON.parse(savedFiles));
    }
    const savedContents = localStorage.getItem('flow-write-file-contents');
    if (savedContents) {
      setFileContents(JSON.parse(savedContents));
    }
  }, []);

  // Save content to localStorage
  useEffect(() => {
    if(isClient) {
      localStorage.setItem('flow-write-content', content);
    }
  }, [content, isClient]);

  // Save files structure to localStorage
  useEffect(() => {
    if(isClient) {
      localStorage.setItem('flow-write-files', JSON.stringify(files));
    }
  }, [files, isClient]);

  // Save content to fileContents state
  useEffect(() => {
    if(isClient && selectedId) {
      setFileContents(prevContents => ({...prevContents, [selectedId]: content}));
    }
  }, [content, selectedId, isClient]);

  // Save fileContents to localStorage
  useEffect(() => {
      if(isClient) {
        localStorage.setItem('flow-write-file-contents', JSON.stringify(fileContents));
      }
  }, [fileContents, isClient]);

  // When selected file changes, update the content in the editor
  useEffect(() => {
    if (selectedId) {
      const fileContent = fileContents[selectedId as keyof typeof fileContents] || '';
      setContent(fileContent);
    } else {
      setContent('');
    }
  }, [selectedId]);

  // Generate session title from content
  const generateTitle = (content: string) => {
    if (!content.trim()) return "Untitled"
    const firstLine = content.split("\n")[0].trim()
    return firstLine.length > 30 ? firstLine.substring(0, 30) + "..." : firstLine || "Untitled"
  }

  // Load sessions from localStorage
  useEffect(() => {
    const savedSessions = localStorage.getItem("writing-sessions")
    if (savedSessions) {
      try {
        const parsedSessions = JSON.parse(savedSessions)
        setSessions(parsedSessions)
      } catch (error) {
        console.error("Failed to load sessions:", error)
      }
    }

    // Load current session
    const currentSession = localStorage.getItem("current-writing-session")
    let loadedSessionId = null;
    if (currentSession) {
      try {
        const session = JSON.parse(currentSession)
        setContent(session.content || "")
        setFontSize(session.fontSize || "18")
        setFontFamily(session.fontFamily || "system")
        setTimeLeft(session.timeLeft || 15 * 60)
        setCurrentSessionId(session.id || null)
        loadedSessionId = session.id || null;
        setWordCount(calculateWordCount(session.content || ""))
        setCharCount((session.content || "").length)
        setIsNoDeleteMode(session.isNoDeleteMode === undefined ? true : session.isNoDeleteMode)
        setPaperStyle(session.paperStyle || "default")
      } catch (error) {
        console.error("Failed to load current session:", error)
      }
    }

    if (!loadedSessionId) {
      setCurrentSessionId(Date.now().toString());
    }

    // System preference for dark mode is handled by next-themes and ThemeProvider
  }, [])

  // Prepare data for FileTree (Simplified: One "Sessions" folder)
  useEffect(() => {
    const sortedSessions = [...sessions].sort((a, b) => b.timestamp - a.timestamp); // Newest first

    if (sortedSessions.length > 0) {
      const treeElements = [
        {
          id: "folder-all-sessions", // Static ID for the main folder
          name: "Sessions",
          children: sortedSessions.map(session => ({
            id: session.id,
            name: session.title || "Untitled Session",
          })),
        }
      ];
      setFileTreeElements(treeElements);
    } else {
      setFileTreeElements([]); // Clear tree if no sessions
    }
  }, [sessions]);

  // Debounced save function
  const debouncedSave = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout
      return (sessionData: any) => {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => {
          setIsSaving(true)
          localStorage.setItem("current-writing-session", JSON.stringify(sessionData))
          setLastSaved(new Date())
          setTimeout(() => setIsSaving(false), 500)
        }, 1000)
      }
    })(),
    [],
  )

  // Save current session
  useEffect(() => {
    if (!currentSessionId) {
      // If currentSessionId is still null after initial load, generate a new one.
      // This check might be redundant if the above useEffect correctly sets it.
      // setCurrentSessionId(Date.now().toString()) 
      return
    }

    const sessionData = {
      id: currentSessionId,
      content,
      fontSize,
      fontFamily,
      timeLeft,
      timestamp: Date.now(),
      isNoDeleteMode,
      paperStyle,
    }
    debouncedSave(sessionData)
  }, [content, fontSize, fontFamily, currentSessionId, debouncedSave, isNoDeleteMode, paperStyle])

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout
    console.log(`[Timer Effect] isTimerRunning: ${isTimerRunning}, timeLeft: ${timeLeft}`);
    if (isTimerRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1)
      }, 1000)
    } else if (timeLeft === 0) {
      setIsTimerRunning(false)
    }
    return () => clearInterval(interval)
  }, [isTimerRunning, timeLeft])

  // Auto-start timer when user starts typing
  useEffect(() => {
    if (content.length > 0 && !isTimerRunning && timeLeft > 0 && !timerManuallyPaused) {
      setIsTimerRunning(true);
    }
  }, [content, isTimerRunning, timeLeft, timerManuallyPaused]);

  // Calculate WPM
  useEffect(() => {
    const initialDurationSeconds = 15 * 60; // Default 15 minutes
    const elapsedSeconds = initialDurationSeconds - timeLeft;
    if (elapsedSeconds > 0 && wordCount > 0) {
      const elapsedMinutes = elapsedSeconds / 60;
      setWpm(Math.round(wordCount / elapsedMinutes));
    } else {
      setWpm(0);
    }
  }, [wordCount, timeLeft]);

  // Typewriter Mode Logic
  useEffect(() => {
    if (isTypewriterMode && textareaRef.current) {
      const textarea = textareaRef.current;
      console.log("--- Typewriter Mode Engaged ---");
      console.log("Textarea clientHeight:", textarea.clientHeight);

      const cursorPosition = textarea.selectionStart;
      console.log("Cursor position:", cursorPosition);

      const textUpToCursor = content.substring(0, cursorPosition);
      const currentLineNumber = textUpToCursor.split('\n').length -1; // 0-indexed
      console.log("Calculated currentLineNumber (0-indexed from \\n splits):", currentLineNumber);

      const currentFontSize = parseFloat(fontSize) || 18;
      const lineHeightMultiplier = 1.625; // for leading-relaxed
      const calculatedLineHeight = currentFontSize * lineHeightMultiplier;
      console.log("Current font size:", currentFontSize, "Calculated lineHeight:", calculatedLineHeight);

      const targetScrollTop =
        currentLineNumber * calculatedLineHeight -
        textarea.clientHeight / 2 +
        calculatedLineHeight / 2;
      console.log("Target scrollTop:", targetScrollTop);
      console.log("Current scrollTop before change:", textarea.scrollTop);

      if (targetScrollTop > 0) {
        textarea.scrollTop = targetScrollTop;
      } else {
        // If target is 0 or negative, and current scroll isn't already 0, reset to 0.
        // This handles cases where user might have scrolled down manually and then typed on an early line.
        if (textarea.scrollTop !== 0) {
          textarea.scrollTop = 0;
        }
      }
      console.log("New scrollTop after change:", textarea.scrollTop);
      console.log("--- Typewriter Mode End of Tick ---");
    }
  }, [content, fontSize, isTypewriterMode, fontFamily]);

  useEffect(() => {
    if (paperStyle === 'notebook' || paperStyle === 'handwritten') {
      setFontFamily('kalam');
    } else {
      setFontFamily('system');
    }
  }, [paperStyle]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const calculateWordCount = (text: string) => {
    if (!text.trim()) return 0
    return text.trim().split(/\s+/).length
  }

  const getFontFamily = (font: string) => {
    switch (font) {
      case "arial":
        return "Arial, sans-serif"
      case "lato":
        return "Lato, sans-serif"
      case "system":
        return "system-ui, -apple-system, sans-serif"
      case "serif":
        return "Georgia, serif"
      case "random":
        return "Comic Sans MS, cursive"
      case "kalam":
        return "var(--font-kalam), cursive"
      default:
        return "system-ui, -apple-system, sans-serif"
    }
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  const resetTimer = () => {
    setTimeLeft(15 * 60)
    setIsTimerRunning(false)
    setTimerManuallyPaused(false)
  }

  const saveCurrentSession = () => {
    if (!currentSessionId) return; 

    const isExistingSessionInList = sessions.find(s => s.id === currentSessionId);
    // Save if content exists OR if it's an existing session (even if content is now empty)
    if (content.trim() || isExistingSessionInList) { 
      let sessionToSave: WritingSession;

      if (isExistingSessionInList) {
        // Update existing session, preserve original date
        sessionToSave = {
          ...isExistingSessionInList, 
          content, 
          timestamp: Date.now(), 
          wordCount: calculateWordCount(content),
          charCount: content.length, // Save charCount
          duration: 15 * 60 - timeLeft, 
          title: generateTitle(content), 
          isNoDeleteMode,
          paperStyle,
        };
      } else {
        // New session not yet in the sessions list.
        // Its ID (currentSessionId) was from Date.now().toString().
        let newSessionDate: string;
        try {
            newSessionDate = new Date(parseInt(currentSessionId, 10)).toISOString().split("T")[0];
        } catch (e) {
            newSessionDate = new Date().toISOString().split("T")[0];
            console.error("Could not parse currentSessionId for date, using current date for new session.", e);
        }
        sessionToSave = {
          id: currentSessionId,
          content,
          date: newSessionDate, // Date from when ID was generated
          timestamp: Date.now(),
          wordCount: calculateWordCount(content),
          charCount: content.length, // Save charCount
          duration: 15 * 60 - timeLeft,
          title: generateTitle(content),
          isNoDeleteMode,
          paperStyle,
        };
      }

      const updatedSessions = [
        sessionToSave,
        ...sessions.filter((s) => s.id !== currentSessionId)
      ].sort((a, b) => b.timestamp - a.timestamp); // Keep sorted by last modified

      setSessions(updatedSessions);
      localStorage.setItem("writing-sessions", JSON.stringify(updatedSessions));
    }
  };

  const newEntry = () => {
    saveCurrentSession()
    setContent("")
    setWordCount(0)
    setCharCount(0)
    setCurrentSessionId(Date.now().toString())
    setPaperStyle("default")
    resetTimer()
    localStorage.removeItem("current-writing-session")
    setLastSaved(null)
    textareaRef.current?.focus()
  }

  const loadSession = (session: WritingSession) => {
    saveCurrentSession()
    setContent(session.content)
    setWordCount(session.wordCount)
    setCharCount(session.content.length)
    setCurrentSessionId(session.id)
    setPaperStyle(session.paperStyle || "default")
    resetTimer()
    textareaRef.current?.focus()
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const today = new Date().toISOString().split("T")[0]
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split("T")[0]

    if (dateString === today) return "Today"
    if (dateString === yesterday) return "Yesterday"
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  const toggleDarkMode = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  // Guard against rendering with null currentSessionId initially for Date parsing
  const displayDate = currentSessionId ? new Date(Number.parseInt(currentSessionId) || Date.now()) : new Date();
  // Make sure to handle potential null or non-string currentSessionId for logging
  const parsedSessionIdAsNumber = currentSessionId ? Number.parseInt(currentSessionId) : null;
  console.log(`[DisplayDate Calc] currentSessionId: ${currentSessionId}, parsed as: ${parsedSessionIdAsNumber}, displayDate value: ${displayDate}, isInvalidDate: ${isNaN(displayDate.getTime())}`);
  if (!isNaN(displayDate.getTime())) {
    console.log(`[DisplayDate Calc] displayDate ISO: ${displayDate.toISOString()}`);
  }

  const handleExport = () => {
    if (!content.trim()) {
      toast({
        title: "Nothing to Export",
        description: "Start writing something before exporting.",
        variant: "destructive",
      });
      return;
    }

    const safeTitle = generateTitle(content).replace(/[^a-z0-9_-\s]/gi, '_').substring(0,50) || 'flow-write-session';
    const filename = `${safeTitle}.txt`;
    exportToFile(content, filename);
    toast({
      title: "Session Exported",
      description: `Your writing session has been saved as ${filename}`,
    });
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isNoDeleteMode && (e.key === "Backspace" || e.key === "Delete")) {
      e.preventDefault()
      setIsShaking(true)
      setTimeout(() => setIsShaking(false), 300) // Duration of the shake animation
      toast({
        title: "Deletion is off", // Simplified title
        variant: "destructive",
        className: "tooltip-like-toast",
      })
    }
  }

  const handleBeforeInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const event = e as unknown as InputEvent; // Cast to InputEvent
    if (isNoDeleteMode && event.inputType === "insertReplacementText") {
      event.preventDefault();
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 300);
      toast({
        title: "Deletion is off", // Simplified title
        variant: "destructive",
        className: "tooltip-like-toast",
      });
    }
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  };

  const handleFileSelect = (fileContent: string) => {
    setContent(fileContent);
  };

  const handleClear = () => {
    setContent('');
    toast({
      title: "Content Cleared",
      description: "Your writing session has been cleared.",
    });
  };

  const handleClearAll = () => {
    // Clear all files and content
    setFiles(initialFiles);
    setFileContents(initialContents);
    setSelectedId("2");
    setContent(initialContents["2"]);
    localStorage.removeItem('flow-write-files');
    localStorage.removeItem('flow-write-file-contents');
    localStorage.removeItem('flow-write-content');
    setShowClearAllDialog(false);
    toast({
      title: "All Content Cleared",
      description: "All files and content have been reset.",
    });
  };

  const handleNewFile = () => {
    const newFile: TreeViewElement = {
      id: Date.now().toString(),
      name: "New File",
      children: [],
    };
    setFiles(prevFiles => {
      const projectsFolder = prevFiles.find(f => f.id === "1");
      if (projectsFolder && projectsFolder.children) {
        projectsFolder.children.push(newFile);
      }
      return [...prevFiles];
    });
  };

  const handleDeleteFile = (fileId: string) => {
    setFiles(prevFiles => {
      const newFiles = prevFiles.map(folder => {
        if (folder.children) {
          folder.children = folder.children.filter(file => file.id !== fileId);
        }
        return folder;
      });
      return newFiles;
    });
    setFileContents(prevContents => {
      const newContents = { ...prevContents };
      delete newContents[fileId];
      return newContents;
    });
    if (selectedId === fileId) {
      setSelectedId(undefined);
    }
  };

  const handleRenameFile = (fileId: string, newName: string) => {
    setFiles(prevFiles => {
      const newFiles = prevFiles.map(folder => {
        if (folder.children) {
          const file = folder.children.find(f => f.id === fileId);
          if (file) {
            file.name = newName;
          }
        }
        return folder;
      });
      return newFiles;
    });
    setFileToRename(null);
  };

  const confirmDelete = () => {
    if (fileToDelete) {
      handleDeleteFile(fileToDelete);
      setFileToDelete(null);
    }
  };

  return (
    <div className={`min-h-screen flex relative ${kalam.variable}`}>
      {/* Revolutionary immersive writing space */}
      <div className="w-full flex flex-col relative group">
        {/* Sophisticated floating header - gracefully appears on hover */}
        <header className={`fixed top-0 left-0 right-0 z-30 px-10 py-6 flex items-center justify-between transition-all duration-500 ease-out ${distractionFree ? 'opacity-0 pointer-events-none -translate-y-4' : 'opacity-0 group-hover:opacity-100 group-hover:translate-y-0 -translate-y-2'}`}>
          <div className="flex items-center gap-6 backdrop-blur-2xl bg-card/70 px-6 py-3 rounded-2xl border border-border/40 shadow-lg shadow-black/5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFilesDialogOpen(true)}
              className="h-9 px-3 hover:bg-accent/50 transition-all rounded-lg flex items-center gap-2"
              title="Files (⌘K)"
            >
              <Command className="h-4 w-4 opacity-70" />
              <span className="text-xs font-medium tracking-[0.15em] text-foreground/70 uppercase">Files</span>
            </Button>
            <h1 className="text-sm font-medium tracking-[0.25em] text-foreground/70 uppercase">Flow</h1>
          </div>
          <div className="flex items-center gap-3 backdrop-blur-2xl bg-card/70 px-4 py-3 rounded-2xl border border-border/40 shadow-lg shadow-black/5">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleDarkMode}
              className="h-9 w-9 p-0 hover:bg-accent/50 transition-all rounded-lg"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4 opacity-70" /> : <Moon className="h-4 w-4 opacity-70" />}
            </Button>
          </div>
        </header>

        {/* Minimal floating clear all button - appears on hover */}
        <div className={`fixed bottom-24 right-8 z-40 transition-all duration-500 ease-out ${distractionFree ? 'opacity-0 pointer-events-none translate-y-8' : 'opacity-0 group-hover:opacity-100 translate-y-0'}`}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowClearAllDialog(true)}
            className="h-10 w-10 p-0 backdrop-blur-2xl bg-card/70 border border-border/40 hover:bg-destructive/10 hover:border-destructive/30 rounded-xl shadow-lg shadow-black/5 transition-all"
            title="Clear All Content"
          >
            <Trash2 className="h-4 w-4 opacity-60" />
          </Button>
        </div>

        {/* Immersive writing canvas with stunning depth */}
        <div className="flex-1 flex items-center justify-center px-12 py-20 transition-all duration-700">
          <div className={`w-full max-w-6xl paper-container paper-${paperStyle} flex flex-col px-20 md:px-28 lg:px-36 py-20 min-h-[75vh] animate-fade-in shadow-2xl shadow-black/5 rounded-3xl`}>
            {/* Elegant timestamp with smooth transitions */}
            <div className={`text-[11px] mb-16 text-muted-foreground/60 font-medium tracking-[0.2em] uppercase transition-all duration-500 ${distractionFree ? 'opacity-0' : 'opacity-100 group-hover:opacity-40'}`}>
              {displayDate.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </div>
            <textarea
              ref={textareaRef}
              value={content}
              onKeyDown={handleTextareaKeyDown}
              onBeforeInput={handleBeforeInput}
              onChange={handleContentChange}
              placeholder={content === "" ? "Begin your journey..." : ""}
              className={`w-full flex-1 bg-transparent focus:outline-none resize-none overflow-y-auto zen-scroll leading-[2] placeholder:text-muted-foreground/40 placeholder:font-light placeholder:italic ${isShaking ? 'animate-shake' : ''}`}
              style={{
                fontSize: `${fontSize}px`,
                fontFamily: getFontFamily(fontFamily),
              }}
              autoFocus
            />
          </div>
        </div>

        {/* Luxurious floating bottom bar - appears elegantly on hover */}
        <div className={`fixed bottom-0 left-0 right-0 z-30 flex items-center justify-center pb-8 transition-all duration-500 ease-out ${distractionFree ? 'opacity-0 pointer-events-none translate-y-8' : 'opacity-0 group-hover:opacity-100 translate-y-0'}`}>
          <div className="backdrop-blur-2xl bg-card/80 border border-border/50 rounded-2xl shadow-2xl shadow-black/10 px-8 py-4 max-w-7xl mx-auto">
            <div className="flex items-center justify-between gap-8">
              {/* Refined style controls */}
              <div className="flex items-center gap-3">
                <Select value={fontSize} onValueChange={setFontSize}>
                  <SelectTrigger className="w-16 h-9 border border-border/40 bg-background/60 shadow-sm text-xs hover:bg-accent/30 rounded-lg transition-all">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="14">14</SelectItem>
                    <SelectItem value="16">16</SelectItem>
                    <SelectItem value="18">18</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="22">22</SelectItem>
                    <SelectItem value="24">24</SelectItem>
                    <SelectItem value="26">26</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={fontFamily} onValueChange={setFontFamily}>
                  <SelectTrigger className="w-28 h-9 border border-border/40 bg-background/60 shadow-sm text-xs hover:bg-accent/30 rounded-lg transition-all">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="serif">Serif</SelectItem>
                    <SelectItem value="arial">Arial</SelectItem>
                    <SelectItem value="lato">Lato</SelectItem>
                    <SelectItem value="kalam">Handwritten</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={paperStyle} onValueChange={setPaperStyle}>
                  <SelectTrigger className="w-28 h-9 border border-border/40 bg-background/60 shadow-sm text-xs hover:bg-accent/30 rounded-lg transition-all">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Modern</SelectItem>
                    <SelectItem value="notebook">Notebook</SelectItem>
                    <SelectItem value="handwritten">Classic</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Beautiful stats display */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground/70 font-medium tracking-wider px-6 py-2 bg-accent/30 rounded-xl">
                <span className="tabular-nums">{wordCount} words</span>
                <span className="opacity-40">•</span>
                <span className="tabular-nums">{charCount} chars</span>
                <span className="opacity-40">•</span>
                <span className="tabular-nums">{wpm} wpm</span>
                {isSaving && (
                  <>
                    <span className="opacity-40">•</span>
                    <span className="text-primary/60 animate-pulse-gentle">auto-saving</span>
                  </>
                )}
              </div>

              {/* Sophisticated action controls */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/40 border border-border/30">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (isTimerRunning) {
                        setTimerManuallyPaused(true);
                      } else {
                        setTimerManuallyPaused(false);
                      }
                      setIsTimerRunning(!isTimerRunning);
                    }}
                    className="h-7 w-7 p-0 hover:bg-background/40 rounded-lg"
                  >
                    {isTimerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </Button>
                  <span className="font-mono text-xs font-medium min-w-[3rem] text-center opacity-80 tabular-nums">
                    {formatTime(timeLeft)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetTimer}
                    className="h-7 w-7 p-0 hover:bg-background/40 rounded-lg"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 hover:bg-accent/40 rounded-lg"
                      aria-label="Menu"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={newEntry} className="gap-2 cursor-pointer text-sm py-2.5">
                      <Plus className="w-4 h-4" />
                      <span>New Session</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExport} className="gap-2 cursor-pointer text-sm py-2.5">
                      <FileText className="w-4 h-4" />
                      <span>Export</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setIsTypewriterMode(!isTypewriterMode)} className="gap-2 cursor-pointer text-sm py-2.5">
                      <Type className="w-4 h-4" />
                      <span>{isTypewriterMode ? "Disable" : "Enable"} Typewriter</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      const newMode = !isNoDeleteMode;
                      setIsNoDeleteMode(newMode);
                      toast({
                        title: newMode ? "Deletion disabled" : "Deletion enabled",
                        className: "tooltip-like-toast",
                        variant: newMode ? "destructive" : "default",
                      });
                    }} className="gap-2 cursor-pointer text-sm py-2.5">
                      <Eraser className="w-4 h-4" />
                      <span>{isNoDeleteMode ? "Enable" : "Disable"} Delete</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={toggleFullscreen} className="gap-2 cursor-pointer text-sm py-2.5">
                      <Maximize className="w-4 h-4" />
                      <span>Fullscreen</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDistractionFree(!distractionFree)} className="gap-2 cursor-pointer text-sm py-2.5">
                      {distractionFree ? <Minimize className="w-4 h-4" /> : <AlignVerticalJustifyCenter className="w-4 h-4" />}
                      <span>{distractionFree ? "Show Interface" : "Focus Mode"}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Elegant Files Dialog */}
      <Dialog open={isFilesDialogOpen} onOpenChange={setIsFilesDialogOpen}>
        <DialogContent className="sm:max-w-[600px] rounded-3xl backdrop-blur-2xl bg-card/95 border-border/50">
          <DialogHeader>
            <DialogTitle className="text-xl font-medium tracking-[0.15em] uppercase text-foreground/80">Files</DialogTitle>
          </DialogHeader>
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-medium text-muted-foreground tracking-[0.15em] uppercase">Projects</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNewFile}
                className="h-8 px-3 hover:bg-accent/60 transition-all rounded-lg text-xs"
              >
                <FilePlus className="h-4 w-4 mr-2" />
                New File
              </Button>
            </div>
            <div className="border border-border/40 rounded-2xl p-4 bg-background/40 max-h-[400px] overflow-y-auto zen-scroll">
              <Tree
                className="p-2"
                elements={files}
                initialSelectedId={selectedId}
              >
                {files.map(element => (
                  <Folder key={element.id} element={element.name} value={element.id}>
                    {element.children?.map(file => (
                      <File
                        key={file.id}
                        value={file.id}
                        handleSelect={() => {
                          setSelectedId(file.id);
                          setIsFilesDialogOpen(false);
                        }}
                        onDelete={() => setFileToDelete(file.id)}
                        onStartRename={() => setFileToRename(file.id)}
                        onRename={(id, newName) => handleRenameFile(id, newName)}
                        isRenaming={fileToRename === file.id}
                      >
                        {file.name}
                      </File>
                    ))}
                  </Folder>
                ))}
              </Tree>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete File Confirmation Dialog */}
      <AlertDialog open={!!fileToDelete} onOpenChange={() => setFileToDelete(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this file?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Your file will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="rounded-xl">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear All Content Confirmation Dialog */}
      <AlertDialog open={showClearAllDialog} onOpenChange={setShowClearAllDialog}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all content?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reset all files and content to their initial state. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAll} className="rounded-xl bg-destructive hover:bg-destructive/90">Clear All</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
