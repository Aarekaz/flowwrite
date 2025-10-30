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
import { Maximize, Plus, Play, Pause, RotateCcw, Clock, AlignVerticalJustifyCenter, Download, MoreHorizontal, Sun, Moon, Type, FileText, Eraser, Folder as FolderIcon, FolderOpen as FolderOpenIcon, Minimize, FolderPlus, FilePlus } from "lucide-react"
import { useTheme } from "next-themes"
import { useToast } from "@/components/ui/use-toast"
import { exportToFile } from "@/lib/exportUtils"
import { Tree, Folder, File } from "@/components/magicui/file-tree"
import { Kalam } from 'next/font/google';
import { Sidebar, SidebarTrigger, SidebarContent, SidebarHeader, SidebarFooter, SidebarProvider, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from "@/components/ui/sidebar"
import { type TreeViewElement } from "@/components/magicui/file-tree";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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
    <SidebarProvider>
    <div className={`min-h-screen flex relative ${kalam.variable}`}>
      {/* Sidebar - for file management */}
      <Sidebar className="border-r-0 shadow-sm">
        <SidebarHeader className="border-b border-border/50 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Files</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNewFile}
              className="h-8 w-8 hover:bg-accent/50"
            >
              <FilePlus className="h-4 w-4" />
            </Button>
          </div>
        </SidebarHeader>
        <SidebarContent className="px-2">
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
                    handleSelect={() => setSelectedId(file.id)}
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
        </SidebarContent>
        <SidebarFooter className="border-t border-border/50 p-3">
          <Button
            variant="ghost"
            onClick={handleClear}
            className="w-full justify-start hover:bg-accent/50"
          >
            <Eraser className="h-4 w-4 mr-2" />
            Clear
          </Button>
        </SidebarFooter>
      </Sidebar>

      {/* Main writing area */}
      <div className="w-full flex flex-col relative">
        {/* Minimalist header with fade on distraction free */}
        <header className={`absolute top-0 left-0 right-0 z-10 px-6 py-4 flex items-center justify-between backdrop-blur-sm bg-background/80 transition-all duration-500 ${distractionFree ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <div className="flex items-center gap-3">
            <SidebarTrigger className="hover:bg-accent/50" />
            <h1 className="text-base font-medium tracking-wide text-foreground/80">FlowWrite</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleDarkMode}
              className="h-8 w-8 p-0 hover:bg-accent/50"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </header>

        {/* Main writing canvas with generous padding */}
        <div className={`flex-1 flex items-center justify-center px-4 sm:px-8 py-20 sm:py-24 transition-all duration-500`}>
          <div className={`w-full max-w-4xl paper-container paper-${paperStyle} flex flex-col px-8 sm:px-12 md:px-16 py-8 sm:py-10 md:py-12 min-h-[500px] sm:min-h-[600px] shadow-sm animate-fade-in`}>
            {/* Elegant timestamp */}
            <div className={`text-xs mb-6 sm:mb-8 text-muted-foreground/70 font-light tracking-wide transition-all duration-500 ${distractionFree ? 'opacity-0' : 'opacity-100'}`}>
              {displayDate.toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
              {" · "}
              {displayDate.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
            <textarea
              ref={textareaRef}
              value={content}
              onKeyDown={handleTextareaKeyDown}
              onBeforeInput={handleBeforeInput}
              onChange={handleContentChange}
              placeholder={content === "" ? "Begin writing..." : ""}
              className={`w-full flex-1 bg-transparent focus:outline-none resize-none overflow-y-auto zen-scroll leading-relaxed placeholder:text-muted-foreground/40 placeholder:font-light ${isShaking ? 'animate-shake' : ''}`}
              style={{
                fontSize: `${fontSize}px`,
                fontFamily: getFontFamily(fontFamily),
              }}
              autoFocus
            />
          </div>
        </div>

        {/* Refined bottom controls - cleaner and more spacious */}
        <div className={`border-t border-border/50 backdrop-blur-sm bg-background/95 transition-all duration-500 ${distractionFree ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}>
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            {/* Left Section - Style Controls */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <Select value={fontSize} onValueChange={setFontSize}>
                <SelectTrigger className="w-16 h-9 border-border/50 shadow-none text-xs hover:bg-accent/50 hover:border-border transition-all">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="14">14px</SelectItem>
                  <SelectItem value="16">16px</SelectItem>
                  <SelectItem value="18">18px</SelectItem>
                  <SelectItem value="20">20px</SelectItem>
                  <SelectItem value="22">22px</SelectItem>
                  <SelectItem value="24">24px</SelectItem>
                </SelectContent>
              </Select>

              <Select value={fontFamily} onValueChange={setFontFamily}>
                <SelectTrigger className="w-28 h-9 border-border/50 shadow-none text-xs hover:bg-accent/50 hover:border-border transition-all">
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
                <SelectTrigger className="w-28 h-9 border-border/50 shadow-none text-xs hover:bg-accent/50 hover:border-border transition-all">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default</SelectItem>
                  <SelectItem value="notebook">Notebook</SelectItem>
                  <SelectItem value="handwritten">Plain</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Center Section - Stats */}
            <div className="flex-grow flex justify-center items-center gap-4 text-xs text-muted-foreground min-w-0">
              <span className="whitespace-nowrap font-medium">
                {wordCount} words
              </span>
              <span className="text-border">·</span>
              <span className="whitespace-nowrap font-medium">
                {charCount} chars
              </span>
              <span className="text-border">·</span>
              <span className="whitespace-nowrap font-medium">
                {wpm} WPM
              </span>
              {isSaving && (
                <>
                  <span className="text-border">·</span>
                  <span className="text-primary/70 animate-pulse-gentle whitespace-nowrap">Saving...</span>
                </>
              )}
              {lastSaved && !isSaving && (
                <>
                  <span className="text-border">·</span>
                  <span className="text-primary/60 whitespace-nowrap">
                    Saved {lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </>
              )}
            </div>

            {/* Right Section - Timer & Actions */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent/30 border border-border/50">
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
                  className="h-7 w-7 p-0 hover:bg-background/50"
                >
                  {isTimerRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </Button>
                <span className="font-mono text-sm font-medium min-w-[3rem] text-center">
                  {formatTime(timeLeft)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetTimer}
                  className="h-7 w-7 p-0 hover:bg-background/50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 hover:bg-accent/50"
                    aria-label="Actions"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={newEntry} className="gap-2 cursor-pointer">
                    <Plus className="w-4 h-4" />
                    <span>New Entry</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExport} className="gap-2 cursor-pointer">
                    <FileText className="w-4 h-4" />
                    <span>Export Session</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setIsTypewriterMode(!isTypewriterMode)} className="gap-2 cursor-pointer">
                    <Type className="w-4 h-4" />
                    <span>{isTypewriterMode ? "Disable" : "Enable"} Typewriter</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    const newMode = !isNoDeleteMode;
                    setIsNoDeleteMode(newMode);
                    toast({
                      title: newMode ? "Deletion is off" : "Deletion is on",
                      className: "tooltip-like-toast",
                      variant: newMode ? "destructive" : "default",
                    });
                  }} className="gap-2 cursor-pointer">
                    <Eraser className="w-4 h-4" />
                    <span>{isNoDeleteMode ? "Enable" : "Disable"} Deleting</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={toggleFullscreen} className="gap-2 cursor-pointer">
                    <Maximize className="w-4 h-4" />
                    <span>Fullscreen</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDistractionFree(!distractionFree)} className="gap-2 cursor-pointer">
                    {distractionFree ? <Minimize className="w-4 h-4" /> : <AlignVerticalJustifyCenter className="w-4 h-4" />}
                    <span>{distractionFree ? "Show UI" : "Focus Mode"}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>
    </div>
    <AlertDialog open={!!fileToDelete} onOpenChange={() => setFileToDelete(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete your file.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </SidebarProvider>
  )
}
