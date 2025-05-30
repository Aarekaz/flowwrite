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
import { Maximize, Plus, Play, Pause, RotateCcw, Clock, AlignVerticalJustifyCenter, Download, MoreHorizontal, Sun, Moon, Type, FileText, Eraser, Folder as FolderIcon, FolderOpen as FolderOpenIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { useToast } from "@/hooks/use-toast"
import { exportToFile } from "@/lib/exportUtils"
import { Tree, Folder, File } from "@/components/magicui/file-tree"

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
}

export default function WritingApp() {
  const [content, setContent] = useState("")
  const [fontSize, setFontSize] = useState("18")
  const [fontFamily, setFontFamily] = useState("system")
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
    }
    debouncedSave(sessionData)
  }, [content, fontSize, fontFamily, currentSessionId, debouncedSave, isNoDeleteMode])

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

  return (
    <div className={`min-h-screen flex relative`}>
      {/* Main writing area */}
      <div className="w-full flex flex-col">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-4xl">
            {/* Subtle timestamp */}
            <div className={`text-xs mb-4 text-foreground/60`}>
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
              onChange={(e) => {
                const newContent = e.target.value
                setContent(newContent)
                setCharCount(newContent.length)
                setWordCount(calculateWordCount(newContent))
              }}
              placeholder={content === "" ? "Begin writing" : ""}
              className={`w-full h-[70vh] resize-none border-none outline-none leading-relaxed 
                bg-background text-foreground placeholder:text-muted-foreground 
                ${content === "" ? 'placeholder:animate-subtle-pulse' : ''}
                ${isShaking ? 'animate-shake' : ''}
              `}
              style={{
                fontSize: `${fontSize}px`,
                fontFamily: getFontFamily(fontFamily),
              }}
              autoFocus
            />
          </div>
        </div>

        {/* Bottom controls */}
        <div className={`border-t p-2 sm:p-3 border-border`}>
          <div className="max-w-4xl mx-auto flex items-center justify-between text-sm">
            {/* Left Section */}
            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
              <Select value={fontSize} onValueChange={setFontSize}>
                <SelectTrigger
                  className={`w-14 h-7 border-none shadow-none text-xs bg-background text-foreground transition-transform duration-150 ease-in-out hover:scale-105 active:scale-95`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="14">14px</SelectItem>
                  <SelectItem value="16">16px</SelectItem>
                  <SelectItem value="18">18px</SelectItem>
                  <SelectItem value="20">20px</SelectItem>
                  <SelectItem value="24">24px</SelectItem>
                </SelectContent>
              </Select>

              <Select value={fontFamily} onValueChange={setFontFamily}>
                <SelectTrigger
                  className={`w-18 h-7 border-none shadow-none text-xs bg-background text-foreground transition-transform duration-150 ease-in-out hover:scale-105 active:scale-95`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lato">Lato</SelectItem>
                  <SelectItem value="arial">Arial</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="serif">Serif</SelectItem>
                  <SelectItem value="random">Random</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Center Section */}
            <div className="flex-grow flex justify-center items-center gap-x-2 text-xs text-gray-400 min-w-0 mx-2 sm:mx-4">
              <span key={`counts-${wordCount}-${charCount}`} className="animate-subtle-scale-fade whitespace-nowrap">
                {wordCount} words, {charCount} chars
              </span>
              <span key={`wpm-${wpm}`} className="animate-subtle-scale-fade whitespace-nowrap">
                {wpm} WPM
              </span>
              {isSaving && <span className="text-blue-500 animate-fade-in-slide-in whitespace-nowrap">Saving...</span>}
              {lastSaved && !isSaving && (
                <span className={"text-green-500 dark:text-green-400 animate-fade-in-slide-in whitespace-nowrap"}>
                  Saved {lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
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
                className={`h-7 px-2 text-foreground hover:bg-accent transition-transform duration-150 ease-in-out hover:scale-110 active:scale-90`}
              >
                {isTimerRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </Button>
              <span className={`font-mono text-base font-medium text-foreground`}>
                {formatTime(timeLeft)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetTimer}
                className={`h-7 px-2 text-foreground hover:bg-accent transition-transform duration-150 ease-in-out hover:scale-110 active:scale-90`}
              >
                <RotateCcw className="w-3 h-3" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-7 px-2 text-muted-foreground hover:bg-accent flex-shrink-0 transition-transform duration-150 ease-in-out hover:scale-105 active:scale-95`}
                    aria-label="Actions"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={newEntry} className="gap-2">
                    <Plus className="w-4 h-4" />
                    <span>New Entry</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExport} className="gap-2">
                    <FileText className="w-4 h-4" />
                    <span>Export Session</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={toggleDarkMode} className="gap-2">
                    {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    <span>{theme === 'dark' ? "Light Mode" : "Dark Mode"}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsTypewriterMode(!isTypewriterMode)} className="gap-2">
                    <Type className="w-4 h-4" />
                    <span>{isTypewriterMode ? "Disable" : "Enable"} Typewriter</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    const newMode = !isNoDeleteMode;
                    setIsNoDeleteMode(newMode);
                    toast({
                      title: newMode ? "Deletion is off" : "Deletion is on", // Concise titles
                      className: "tooltip-like-toast", // Apply tooltip style
                      variant: newMode ? "destructive" : "default",
                    });
                  }} className="gap-2">
                    <Eraser className="w-4 h-4" />
                    <span>{isNoDeleteMode ? "Enable" : "Disable"} Deleting</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={toggleFullscreen} className="gap-2">
                    <Maximize className="w-4 h-4" />
                    <span>Fullscreen</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </div>

      {/* File Tree Sidebar - Minimalist Floating */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 w-72 max-h-[75vh] flex flex-col overflow-hidden">
        <div className="overflow-y-auto flex-grow">
          {fileTreeElements.length > 0 ? (
            <Tree
              initialSelectedId={currentSessionId || undefined}
              indicator
              initialExpandedItems={["folder-all-sessions"]} // Keep the main "Sessions" folder expanded
              className="pt-2 pb-4 px-1"
            >
              {fileTreeElements.map((folderElement) => (
                <Folder
                  key={folderElement.id}
                  element={folderElement.name}
                  value={folderElement.id}
                >
                  {folderElement.children.map((fileElement: any) => (
                    <File
                      key={fileElement.id}
                      value={fileElement.id}
                      isSelectable={true}
                      isSelect={currentSessionId === fileElement.id}
                      fileIcon={<FileText className="w-4 h-4" />}
                      onClick={() => {
                        const sessionToLoad = sessions.find(s => s.id === fileElement.id);
                        if (sessionToLoad) {
                          loadSession(sessionToLoad);
                        }
                      }}
                    >
                      <span className="truncate text-sm">{fileElement.name}</span>
                    </File>
                  ))}
                </Folder>
              ))}
            </Tree>
          ) : (
            <p className="text-sm text-muted-foreground mt-2">No saved sessions yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
