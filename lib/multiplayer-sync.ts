// Enhanced cross-device multiplayer synchronization
export class MultiplayerSync {
  private static instance: MultiplayerSync
  private eventListeners: Map<string, Function[]> = new Map()
  private syncInterval: any = null
  private lastKnownData: Record<string, any> = {}

  static getInstance(): MultiplayerSync {
    if (!MultiplayerSync.instance) {
      MultiplayerSync.instance = new MultiplayerSync()
    }
    return MultiplayerSync.instance
  }

  // Start listening for changes across devices
  startSync(roomCode: string, callback: (data: any) => void) {
    this.stopSync() // Stop any existing sync

    this.syncInterval = setInterval(() => {
      const rooms = this.getGlobalRooms()
      const roomData = rooms[roomCode]

      if (roomData) {
        // Only call callback if data has actually changed
        const dataString = JSON.stringify(roomData)
        if (this.lastKnownData[roomCode] !== dataString) {
          this.lastKnownData[roomCode] = dataString
          callback(roomData)
        }
      }
    }, 150) // Even faster polling for lobby updates
  }

  stopSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = null
    }
    this.lastKnownData = {}
  }

  private getGlobalRooms(): Record<string, any> {
    try {
      const data = localStorage.getItem("chromatic_rings_global")
      return data ? JSON.parse(data) : {}
    } catch {
      return {}
    }
  }

  updateRoom(roomCode: string, roomData: any) {
    const rooms = this.getGlobalRooms()
    const updatedRoomData = { ...roomData, lastUpdate: Date.now() }
    rooms[roomCode] = updatedRoomData

    // Save to localStorage
    localStorage.setItem("chromatic_rings_global", JSON.stringify(rooms))

    // Update our cache
    this.lastKnownData[roomCode] = JSON.stringify(updatedRoomData)

    // Trigger storage event for same-origin tabs
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "chromatic_rings_global",
        newValue: JSON.stringify(rooms),
      }),
    )
  }

  // Listen for storage changes from other tabs
  onStorageChange(callback: (roomCode: string, data: any) => void) {
    const handler = (e: StorageEvent) => {
      if (e.key === "chromatic_rings_global" && e.newValue) {
        try {
          const rooms = JSON.parse(e.newValue)
          Object.entries(rooms).forEach(([code, data]) => {
            // Only trigger callback if data has changed
            const dataString = JSON.stringify(data)
            if (this.lastKnownData[code] !== dataString) {
              this.lastKnownData[code] = dataString
              callback(code, data)
            }
          })
        } catch (error) {
          console.error("Error parsing storage data:", error)
        }
      }
    }

    window.addEventListener("storage", handler)
    return () => window.removeEventListener("storage", handler)
  }

  // Clean up old rooms
  cleanupRooms() {
    const rooms = this.getGlobalRooms()
    const now = Date.now()
    const cleanedRooms: Record<string, any> = {}

    Object.entries(rooms).forEach(([code, room]: [string, any]) => {
      // Keep rooms that are less than 2 hours old
      if (now - room.lastUpdate < 7200000) {
        cleanedRooms[code] = room
      }
    })

    localStorage.setItem("chromatic_rings_global", JSON.stringify(cleanedRooms))
  }
}
