"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Maximize, Plus, Play, Pause, RotateCcw, Clock, AlignVerticalJustifyCenter } from "lucide-react"
import { useTheme } from "next-themes"

interface WritingSession {
  id: string
  content: string
  date: string
  timestamp: number
  wordCount: number
  duration: number
  title?: string
}

export default function WritingApp() {
  const [content, setContent] = useState("")
  const [fontSize, setFontSize] = useState("18")
  const [fontFamily, setFontFamily] = useState("system")
  const [timeLeft, setTimeLeft] = useState(15 * 60)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
      } catch (error) {
        console.error("Failed to load current session:", error)
      }
    }

    if (!loadedSessionId) {
      setCurrentSessionId(Date.now().toString());
    }

    // System preference for dark mode is handled by next-themes and ThemeProvider
  }, [])

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
    }
    debouncedSave(sessionData)
  }, [content, fontSize, fontFamily, timeLeft, currentSessionId, debouncedSave])

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout
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
    if (content.length > 0 && !isTimerRunning && timeLeft > 0) {
      setIsTimerRunning(true)
    }
  }, [content, isTimerRunning, timeLeft])

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
  }

  const saveCurrentSession = () => {
    if (content.trim()) {
      const session: WritingSession = {
        id: currentSessionId || "",
        content,
        date: new Date().toISOString().split("T")[0],
        timestamp: Date.now(),
        wordCount,
        duration: 15 * 60 - timeLeft,
        title: generateTitle(content),
      }

      const updatedSessions = [session, ...sessions.filter((s) => s.id !== session.id)]
      setSessions(updatedSessions)
      localStorage.setItem("writing-sessions", JSON.stringify(updatedSessions))
    }
  }

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
          <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between text-sm">
            <div className="flex items-center gap-2 sm:gap-6 mb-1 sm:mb-0 flex-wrap">
              <div className="flex items-center gap-2 text-gray-500">
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

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsTimerRunning(!isTimerRunning)}
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleDarkMode}
                  className={`h-7 px-2 text-foreground hover:bg-accent transition-transform duration-150 ease-in-out hover:scale-110 active:scale-90`}
                  aria-label="Toggle dark mode"
                >
                  {theme === 'dark' ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-yellow-300"
                    >
                      <circle cx="12" cy="12" r="5"></circle>
                      <line x1="12" y1="1" x2="12" y2="3"></line>
                      <line x1="12" y1="21" x2="12" y2="23"></line>
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                      <line x1="1" y1="12" x2="3" y2="12"></line>
                      <line x1="21" y1="12" x2="23" y2="12"></line>
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-gray-500"
                    >
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                    </svg>
                  )}
                </Button>
              </div>
            </div>

            <div className="flex items-center flex-wrap w-full justify-between gap-2 sm:w-auto sm:justify-start sm:gap-4">
              <div className="flex items-center flex-wrap gap-x-2 text-xs text-gray-400 min-w-0">
                <span key={`counts-${wordCount}-${charCount}`} className="animate-subtle-scale-fade">
                  {wordCount} words, {charCount} chars
                </span>
                <span key={`wpm-${wpm}`} className="animate-subtle-scale-fade">
                  {wpm} WPM
                </span>
                {isSaving && <span className="text-blue-500 animate-fade-in-slide-in">Saving...</span>}
                {lastSaved && !isSaving && (
                  <span className={"text-green-500 dark:text-green-400 animate-fade-in-slide-in"}>
                    Saved {lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={toggleFullscreen}
                className={`h-7 px-2 text-muted-foreground hover:bg-accent flex-shrink-0 transition-transform duration-150 ease-in-out hover:scale-105 active:scale-95`}
              >
                <Maximize className="w-3 h-3 mr-1" />
                <span className="hidden sm:inline">Fullscreen</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsTypewriterMode(!isTypewriterMode)}
                className={`h-7 px-2 text-muted-foreground hover:bg-accent flex-shrink-0 transition-transform duration-150 ease-in-out hover:scale-105 active:scale-95 ${isTypewriterMode ? 'bg-accent text-accent-foreground' : ''}`}
                title={isTypewriterMode ? "Disable Typewriter Mode" : "Enable Typewriter Mode"}
              >
                <AlignVerticalJustifyCenter className="w-3.5 h-3.5" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={newEntry}
                className={`h-7 px-2 text-muted-foreground hover:bg-accent flex-shrink-0 group transition-transform duration-150 ease-in-out hover:scale-105 active:scale-95`}
              >
                <Plus className="w-3 h-3 mr-1 group-hover:rotate-90 transition-transform duration-300 ease-in-out" />
                <span className="hidden sm:inline">New Entry</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed-height Timeline */}
      <div className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-col items-center">
        <div className="relative flex flex-col items-center h-[300px]">
          {/* Top marker */}
          <div
            className={`w-6 h-1 bg-orange-400 mb-1 relative group`}
            onClick={() => {
              // Find today's sessions
              const today = new Date().toISOString().split("T")[0]
              const todaySessions = sessions.filter((s) => s.date === today)
              if (todaySessions.length > 0) {
                loadSession(todaySessions[0])
              }
            }}
            onMouseEnter={() => setShowSessionTooltip("today")}
            onMouseLeave={() => setShowSessionTooltip(null)}
          >
            {showSessionTooltip === "today" && (
              <div
                className={`absolute right-full mr-2 top-0 bg-card shadow-md rounded-md p-2 w-48 z-10 transition-all duration-300 ease-in-out ${showSessionTooltip === "today" ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}
              >
                <h4 className={`text-sm font-medium text-card-foreground`}>Today</h4>
                <div className="text-xs text-muted-foreground mt-1">
                  {sessions.filter((s) => s.date === new Date().toISOString().split("T")[0]).length} sessions
                </div>
              </div>
            )}
          </div>

          {/* Timeline line - fixed height */}
          <div className={`h-full w-px bg-border`}>
            {/* Session markers - fixed positions */}
            {sessions.slice(0, 10).map((session, index) => {
              // Fixed positions with equal spacing
              const spacing = 100 / (Math.min(10, sessions.length) + 1)
              const position = spacing * (index + 1)

              return (
                <div
                  key={session.id}
                  style={{ top: `${position}%` }}
                  className={`absolute w-4 h-0.5 -left-2 bg-muted-foreground cursor-pointer hover:bg-orange-400 transition-colors relative group`}
                  onClick={() => loadSession(session)}
                  onMouseEnter={() => setShowSessionTooltip(session.id)}
                  onMouseLeave={() => setShowSessionTooltip(null)}
                >
                  {/* Tooltip on hover */}
                  {showSessionTooltip === session.id && (
                    <div
                      className={`absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-card shadow-md rounded-md p-2 w-48 z-10 transition-all duration-300 ease-in-out ${showSessionTooltip === session.id ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}
                    >
                      <h4 className={`text-sm font-medium truncate text-card-foreground`}>
                        {session.title}
                      </h4>
                      <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                        <span>{formatDate(session.date)}</span>
                        <span>•</span>
                        <span>{session.wordCount} words</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Bottom marker */}
          <div className={`w-6 h-0.5 bg-muted-foreground mt-1`}></div>

          {/* Session count indicator */}
          <div className={`mt-2 flex items-center gap-1 text-xs text-muted-foreground`}>
            <Clock className="w-3 h-3" />
            <span>{sessions.length}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
