/**
 * INSPICO ARTS GALLERY 2026 - TV RESULTS & SCANNER APP
 * Directly matched to Art Gallery V1 LandingPage.css & Design System
 * Supabase Data Integration + Camera QR Scanner + Full Keyboard Navigation
 */

// Supabase Configuration from Art Gallery V1
const SUPABASE_URL = 'https://bqmvrhqztxsgjosicsdj.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxbXZyaHF6dHhzZ2pvc2ljc2RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4MzkwODksImV4cCI6MjA5OTQxNTA4OX0.ExrJr9AaLGxo4KxybSY9UCPWXcSolz2OAZTGeHnNnUc'

class TvApp {
  constructor() {
    this.supabase = null
    this.html5QrCode = null
    this.isCameraRunning = false
    this.selectedCameraId = null
    this.audioEnabled = true
    this.audioCtx = null

    // State
    this.currentView = 'dashboard' // 'dashboard' | 'standby' | 'result'
    this.currentParticipant = null
    this.currentRegistrations = []
    this.currentResults = []
    this.scanHistory = [] // array of chest numbers
    this.focusedCardIndex = 0
    this.currentFilter = 'all' // 'all' | 'results' | 'scheduled'
    this.dashboardSyncInterval = null
    this.dashboardPointsData = []

    // Auto-Standby Timer
    this.countdownMax = 45 // 45 seconds
    this.countdownRemaining = 45
    this.countdownInterval = null
    this.isCountdownPaused = false

    // DOM Elements
    this.dom = {
      viewDashboard: document.getElementById('viewDashboard'),
      dashboardPodiumGrid: document.getElementById('dashboardPodiumGrid'),
      dbTotalPoints: document.getElementById('dbTotalPoints'),
      dbPublishedEvents: document.getElementById('dbPublishedEvents'),
      dbTotalParticipants: document.getElementById('dbTotalParticipants'),
      dbLatestWinnerName: document.getElementById('dbLatestWinnerName'),
      btnToggleNavView: document.getElementById('btnToggleNavView'),
      navViewLabel: document.getElementById('navViewLabel'),
      viewStandby: document.getElementById('viewStandby'),
      viewResult: document.getElementById('viewResult'),
      loadingOverlay: document.getElementById('loadingOverlay'),
      loadingSubtitle: document.getElementById('loadingSubtitle'),
      cameraStatusText: document.getElementById('cameraStatusText'),
      cameraStatusPill: document.getElementById('cameraStatusPill'),
      liveClock: document.getElementById('liveClock'),
      chestInput: document.getElementById('chestInput'),
      cameraSelect: document.getElementById('cameraSelect'),
      scannerFeedbackFlash: document.getElementById('scannerFeedbackFlash'),
      feedbackText: document.getElementById('feedbackText'),
      statParticipants: document.getElementById('statParticipants'),
      statCompetitions: document.getElementById('statCompetitions'),
      statPublished: document.getElementById('statPublished'),
      recentResultsList: document.getElementById('recentResultsList'),
      btnBackStandby: document.getElementById('btnBackStandby'),
      btnPauseCam: document.getElementById('btnPauseCam'),
      btnFullscreen: document.getElementById('btnFullscreen'),
      btnMute: document.getElementById('btnMute'),
      btnHelp: document.getElementById('btnHelp'),
      btnCloseHelp: document.getElementById('btnCloseHelp'),
      helpModal: document.getElementById('helpModal'),
      tvToast: document.getElementById('tvToast'),
      toastMessage: document.getElementById('toastMessage'),
      countdownBar: document.getElementById('countdownBar'),
      countdownText: document.getElementById('countdownText'),
      btnPauseCountdown: document.getElementById('btnPauseCountdown'),
      
      // Participant Card
      resChestNo: document.getElementById('resChestNo'),
      resName: document.getElementById('resName'),
      resTeam: document.getElementById('resTeam'),
      resCategory: document.getElementById('resCategory'),
      resTotalEvents: document.getElementById('resTotalEvents'),
      resTotalPoints: document.getElementById('resTotalPoints'),
      resTopPlaces: document.getElementById('resTopPlaces'),
      recentHistoryPills: document.getElementById('recentHistoryPills'),

      // Feed
      competitionsListCards: document.getElementById('competitionsListCards'),
      competitionsScrollContainer: document.getElementById('competitionsScrollContainer'),
      tabFilterAll: document.getElementById('tabFilterAll'),
      tabFilterResults: document.getElementById('tabFilterResults'),
      tabFilterScheduled: document.getElementById('tabFilterScheduled'),
      countAllEvents: document.getElementById('countAllEvents'),
      countPublishedEvents: document.getElementById('countPublishedEvents'),
      countScheduledEvents: document.getElementById('countScheduledEvents'),

      // Breaking Result Announcement Overlay
      resultAnnouncementOverlay: document.getElementById('resultAnnouncementOverlay'),
      announcementCompCategory: document.getElementById('announcementCompCategory'),
      announcementCompTitle: document.getElementById('announcementCompTitle'),
      announcementPodiumGrid: document.getElementById('announcementPodiumGrid'),
      announcementTimerText: document.getElementById('announcementTimerText'),
      announcementProgressBar: document.getElementById('announcementProgressBar'),
      btnCloseAnnouncement: document.getElementById('btnCloseAnnouncement'),

      // Milestone Poster Showcase
      dashboardPosterShowcase: document.getElementById('dashboardPosterShowcase'),
      dashboardPosterImg: document.getElementById('dashboardPosterImg'),

      // Remote Blackout Overlay
      tvBlackoutOverlay: document.getElementById('tvBlackoutOverlay'),

      // Remote Video Broadcast Overlay
      tvVideoOverlay: document.getElementById('tvVideoOverlay'),
      tvVideoPlayer: document.getElementById('tvVideoPlayer'),
      tvVideoLoader: document.getElementById('tvVideoLoader'),
      tvVideoLoaderText: document.getElementById('tvVideoLoaderText'),

      // Remote Gallery Slideshow Overlay
      tvSlideshowOverlay: document.getElementById('tvSlideshowOverlay'),
      slideshowSlideA: document.getElementById('slideshowSlideA'),
      slideshowSlideB: document.getElementById('slideshowSlideB')
    }

    this.seenPublishedCompIds = new Set()
    this.isAnnouncementActive = false
    this.announcementCountdownInterval = null
    this.preloadedPosterCache = new Map()
    this.activeMilestonePosterUrl = null
    this.posterRotationTimer = null
    this.isVideoPlaying = false
    this.currentPlayingVideoUrl = null
    this.wasVideoPlayingBeforeAnnouncement = false

    // Slideshow state
    this.isSlideshowActive = false
    this.slideshowPhotos = []
    this.slideshowIndex = 0
    this.slideshowInterval = null
    this.currentSlideSlot = 'A'
    this.wasSlideshowActiveBeforeAnnouncement = false

    this.init()
  }

  async init() {
    this.initClock()
    this.initHeaderToggle()
    this.initAutoUpdateChecker()
    this.initLocalStatePoller()
    this.initSupabase()
    this.initAudio()
    this.initKeyboardControls()
    this.initEventListeners()
    
    // 1. Initialize Published Result History FIRST so existing results are marked as seen
    await this.initPublishedResultHistory()

    // 2. Fetch & Render Main TV Dashboard Points (Default View)
    await this.fetchDashboardPoints()
    this.startDashboardSync()

    // 3. Set up Instant Realtime WebSocket (0ms instant updates)
    this.initRealtimeResultListener()

    // 4. Default to Main TV Live Standings Broadcast View
    this.switchView('dashboard', false)
  }

  // --------------------------------------------------------------------------
  // SUPABASE INITIALIZATION & QUERIES
  // --------------------------------------------------------------------------
  initSupabase() {
    try {
      if (window.supabase && typeof window.supabase.createClient === 'function') {
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      } else {
        console.warn('Supabase SDK not yet initialized')
      }
    } catch (e) {
      console.error('Failed to initialize Supabase client:', e)
    }
  }

  // --------------------------------------------------------------------------
  // LIVE CHAMPIONSHIP POINTS DASHBOARD ENGINE (MILESTONE STATUS BASED)
  // --------------------------------------------------------------------------
  async fetchDashboardPoints() {
    if (!this.supabase) return
    if (this.isFetchingDashboard) return
    this.isFetchingDashboard = true

    try {
      // 1. Fetch App Settings, Teams, Published Results, and Gallery Media Posters in Parallel
      const [settingsRes, teamsRes, resultsRes, partsCountRes, compsCountRes, galleryMediaRes] = await Promise.all([
        this.supabase.from('app_settings').select('key, value'),
        this.supabase.from('teams').select('id, name').order('name'),
        this.supabase.from('competition_results')
          .select('position, grade, placement_points, grade_points, competition_id, participants(team_id)')
          .eq('published', true),
        this.supabase.from('participants').select('id', { count: 'exact', head: true }),
        this.supabase.from('competitions').select('id', { count: 'exact', head: true }),
        this.supabase.from('gallery_media')
          .select('id, milestone, hd_url, thumb_url, created_at')
          .not('milestone', 'is', null)
          .order('created_at', { ascending: false })
      ])

      const settings = settingsRes.data || []
      const teamsData = teamsRes.data || []
      const resultsData = resultsRes.data || []

      // Extract milestone & announcer sequence (Same as V1 LandingPage.jsx:1113-1130)
      const revSetting = settings.find(s => s.key === 'leaderboard_revealed_milestone')
      const seqSetting = settings.find(s => s.key === 'announcer_sequence')
      const colorSetting = settings.find(s => s.key === 'team_colors')

      const revealedMilestone = parseInt(revSetting?.value || '0', 10)

      let rawSeq = []
      try {
        if (seqSetting?.value) rawSeq = JSON.parse(seqSetting.value)
      } catch (e) {}

      // Extract only competition IDs from sequence (ignoring divider objects)
      const seqCompIds = rawSeq
        .map(i => (typeof i === 'string' ? i : (i?.isDivider ? null : i?.id)))
        .filter(Boolean)

      this.announcerSeqCompIds = seqCompIds

      // Only include competitions up to the revealed milestone divider (e.g. After 40 Results)
      const includedComps = revealedMilestone > 0 ? seqCompIds.slice(0, revealedMilestone) : seqCompIds
      const excludeComps = revealedMilestone > 0 ? seqCompIds.slice(revealedMilestone) : []

      // Try RPC first (matching V1 LandingPage.jsx:1131)
      let rpcData = null
      try {
        const { data } = await this.supabase.rpc('get_team_standings', {
          exclude_comps: excludeComps || []
        })
        if (data && data.length > 0) {
          rpcData = data
        }
      } catch (e) {}

      // Official Team Colors
      let colorMap = {}
      if (colorSetting?.value) {
        try { colorMap = JSON.parse(colorSetting.value) } catch (e) {}
      }
      const defaultTeamColors = {
        'Sharqawi': '#ff4757',
        'Zahrawi': '#e056fd',
        'Barmawi': '#1e90ff'
      }

      // Initialize teamMap
      const teamMap = {}
      teamsData.forEach(t => {
        teamMap[t.id] = {
          id: t.id,
          name: t.name,
          color: colorMap[t.id] || defaultTeamColors[t.name] || '#B8193C',
          totalPoints: 0,
          placementPoints: 0,
          gradePoints: 0,
          p1: 0,
          p2: 0,
          p3: 0,
          gradeA: 0,
          totalGrades: 0
        }
      })

      // If RPC provided points, set them
      if (rpcData) {
        rpcData.forEach(r => {
          if (teamMap[r.team_id]) {
            teamMap[r.team_id].totalPoints = Number(r.points) || 0
          }
        })
      }

      // Aggregate details (placement, grade, medals) for included competitions only
      let overallTotalPoints = 0
      const publishedCompIds = new Set()

      resultsData.forEach(r => {
        if (r.competition_id) publishedCompIds.add(r.competition_id)

        // Only count if competition is within the revealed milestone
        const isIncluded = includedComps.length > 0 
          ? includedComps.includes(r.competition_id) 
          : (!excludeComps || !excludeComps.includes(r.competition_id))
        
        if (!isIncluded) return

        const tid = r.participants?.team_id
        const p = Number(r.placement_points) || 0
        const g = Number(r.grade_points) || 0
        const pts = p + g
        overallTotalPoints += pts

        if (tid && teamMap[tid]) {
          teamMap[tid].placementPoints += p
          teamMap[tid].gradePoints += g
          if (!rpcData) {
            teamMap[tid].totalPoints += pts
          }

          if (r.position === 1) teamMap[tid].p1++
          else if (r.position === 2) teamMap[tid].p2++
          else if (r.position === 3) teamMap[tid].p3++

          if (r.grade) {
            teamMap[tid].totalGrades++
            if (r.grade.includes('A')) teamMap[tid].gradeA++
          }
        }
      })

      if (rpcData) {
        overallTotalPoints = Object.values(teamMap).reduce((sum, t) => sum + t.totalPoints, 0)
      }

      // Sort Teams: Total Points (Desc), then Placement Points, then Golds
      const sortedTeams = Object.values(teamMap).sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
        if (b.placementPoints !== a.placementPoints) return b.placementPoints - a.placementPoints
        return b.goldCount - a.goldCount
      })

      // Check if data / milestone actually changed
      const pointsSignature = sortedTeams.map(t => `${t.id}:${t.totalPoints}`).join('|') + `|m:${revealedMilestone}`
      const hasChanged = this.lastPointsSignature !== pointsSignature

      this.lastPointsSignature = pointsSignature
      this.dashboardPointsData = sortedTeams
      this.revealedMilestone = revealedMilestone

      // Update Header with exact Milestone text (e.g. STATUS AFTER 40 RESULTS or FINAL STATUS)
      const totalCompsCount = Number(compsCountRes?.count) || seqCompIds.length || 0
      const isAllResultsPublished = (totalCompsCount > 0 && (revealedMilestone >= totalCompsCount || publishedCompIds.size >= totalCompsCount)) || (revealedMilestone >= 135)
      this.isAllResultsPublished = isAllResultsPublished

      const headingEl = document.getElementById('dashboardMilestoneTitle') || document.querySelector('.broadcast-main-heading')
      if (headingEl) {
        if (isAllResultsPublished) {
          headingEl.textContent = 'FINAL STATUS'
        } else if (revealedMilestone > 0) {
          headingEl.textContent = `STATUS AFTER ${revealedMilestone} RESULTS`
        } else if (publishedCompIds.size > 0) {
          headingEl.textContent = `STATUS AFTER ${publishedCompIds.size} RESULTS`
        } else {
          headingEl.textContent = `POINTS STANDINGS`
        }
      }

      // Render the 3 Team Podium Cards ONLY on initial load OR when points/milestones change
      if (hasChanged || !this.hasInitialPodiumRendered) {
        this.hasInitialPodiumRendered = true
        this.renderDashboardPodium(sortedTeams)
      }

      // Check and Preload Milestone Poster from gallery_media / storage (Zero chunking / Zero blank screen)
      let posterUrl = null
      const galleryPosters = galleryMediaRes?.data || []

      // 1. Strict exact match for the CURRENT active milestone only!
      // (Never show an old/previous milestone poster if the new one hasn't been uploaded yet)
      if (revealedMilestone > 0) {
        const exactMatch = galleryPosters.find(p => Number(p.milestone) === revealedMilestone)
        if (exactMatch) {
          posterUrl = exactMatch.hd_url || exactMatch.thumb_url
        }

        // Fallback: Check divider object at exact milestone in announcer sequence
        if (!posterUrl) {
          let compCount = 0
          for (const item of rawSeq) {
            if (!item) continue
            const isDiv = typeof item !== 'string' && (item.isDivider || item.type === 'divider' || item.divider || item.is_divider)
            if (isDiv) {
              if (compCount === revealedMilestone) {
                posterUrl = item.poster_url || item.posterUrl || item.poster || item.image_url || item.imageUrl || item.image || item.url || item.file_url || null
                break
              }
            } else {
              compCount++
            }
          }
        }

        // Fallback: Check dedicated milestone poster setting (e.g. milestone_poster_70)
        if (!posterUrl) {
          posterUrl = settings.find(s => s.key === `milestone_poster_${revealedMilestone}` || s.key === `poster_${revealedMilestone}` || s.key === `milestone_${revealedMilestone}_poster`)?.value
        }
      }

      console.log('🖼️ Milestone Poster Extracted from DB:', { revealedMilestone, posterUrl })

      if (posterUrl) {
        this.handleMilestonePoster(posterUrl)
      } else {
        this.clearMilestonePoster()
      }

      // Check Remote Control TV State (e.g. Blank Screen toggle from /admin?123)
      const remoteSetting = settings.find(s => s.key === 'tv_remote_control')
      if (remoteSetting?.value) {
        try {
          const remoteState = typeof remoteSetting.value === 'string' ? JSON.parse(remoteSetting.value) : remoteSetting.value
          this.handleTvRemoteState(remoteState)
        } catch (e) {}
      } else {
        this.handleTvRemoteState({ blank_screen: false })
      }

      // Update Bottom Stats Tiles
      if (this.dom.dbTotalPoints) {
        this.animateNumber(this.dom.dbTotalPoints, overallTotalPoints)
      }
      if (this.dom.dbPublishedEvents) {
        if (isAllResultsPublished) {
          this.dom.dbPublishedEvents.textContent = `${totalCompsCount || publishedCompIds.size} Results (Final Status)`
        } else if (revealedMilestone > 0) {
          this.dom.dbPublishedEvents.textContent = `${revealedMilestone} Results (Status Point)`
        } else {
          this.dom.dbPublishedEvents.textContent = `${publishedCompIds.size} / ${compsCountRes.count || '--'}`
        }
      }
      if (this.dom.dbTotalParticipants && partsCountRes.count !== null) {
        this.dom.dbTotalParticipants.textContent = partsCountRes.count
      }

      // Fetch Latest Winner Announcement
      this.fetchLatestWinnerAnnouncement()

      // Update sync time
      const syncEl = document.getElementById('dbSyncTimeText')
      if (syncEl) {
        const now = new Date()
        syncEl.textContent = `Live: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
      }

    } catch (err) {
      console.error('Error fetching dashboard points:', err)
    } finally {
      this.isFetchingDashboard = false
    }
  }

  renderDashboardPodium(teams) {
    if (!this.dom.dashboardPodiumGrid) return
    if (teams.length === 0) {
      this.dom.dashboardPodiumGrid.innerHTML = `
        <div class="dashboard-loading-state">
          <span>Awaiting Published Results...</span>
        </div>
      `
      return
    }

    this.latestTeamsData = teams
    const maxPoints = Math.max(...teams.map(t => t.totalPoints), 1)

    // Render HTML structure
    this.dom.dashboardPodiumGrid.innerHTML = teams.map((team, idx) => {
      const isLeader = idx === 0
      const rank = idx + 1

      return `
        <div class="podium-team-card rank-${rank} ${isLeader ? 'rank-1-leader' : ''}" style="--team-color: ${team.color};">
          <div class="team-accent-glow-top" style="background: ${team.color};"></div>
          
          <div class="podium-card-header">
            <div class="pro-rank-badge rank-${rank}">
              <span class="pro-rank-label">RANK</span>
              <span class="pro-rank-num">0${rank}</span>
              ${isLeader ? `
                <svg class="pro-svg-crown" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/>
                </svg>
              ` : ''}
            </div>
            ${isLeader ? `<div class="leader-badge-pill">LEADING</div>` : ''}
          </div>

          <div class="team-identity-block">
            <h2 class="team-display-name">${this.escapeHtml(team.name)}</h2>
          </div>

          <div class="team-score-block">
            <div class="score-points-number" id="pts-count-${team.id}" data-val="${team.totalPoints}">0</div>
            <div class="score-unit-text">POINTS</div>

            <div class="team-progress-bar-wrap">
              <div class="team-progress-bar-fill" id="bar-fill-${team.id}" style="width: 0%; background: ${team.color};"></div>
            </div>
          </div>

          <!-- Professional Place and Grade Counts (Zero Emojis, Pro SVGs) -->
          <div class="team-pro-counts-row">
            <div class="pro-count-chip chip-gold" title="1st Place Count">
              <svg class="pro-count-svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/>
              </svg>
              <span class="pro-chip-name">1ST</span>
              <span class="pro-chip-val">${team.p1}</span>
            </div>

            <div class="pro-count-chip chip-silver" title="2nd Place Count">
              <svg class="pro-count-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>
              </svg>
              <span class="pro-chip-name">2ND</span>
              <span class="pro-chip-val">${team.p2}</span>
            </div>

            <div class="pro-count-chip chip-bronze" title="3rd Place Count">
              <svg class="pro-count-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>
              </svg>
              <span class="pro-chip-name">3RD</span>
              <span class="pro-chip-val">${team.p3}</span>
            </div>

            <div class="pro-count-chip chip-grade" title="A-Grade Count">
              <svg class="pro-count-svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l2.4 7.2h7.6l-6.1 4.5 2.3 7.3-6.2-4.6-6.2 4.6 2.3-7.3-6.1-4.5h7.6z"/>
              </svg>
              <span class="pro-chip-name">A GRD</span>
              <span class="pro-chip-val">${team.gradeA}</span>
            </div>
          </div>
        </div>
      `
    }).join('')

    // Play initial high-suspense animation
    this.playBroadcastPointsRoll(teams, maxPoints)

    // Oru idavelayitt veendum aa animation kanikkuka (Periodic broadcast replay every 30s)
    if (!this.broadcastReplayInterval) {
      this.broadcastReplayInterval = setInterval(() => {
        if (this.currentView === 'dashboard' && this.latestTeamsData && this.latestTeamsData.length > 0) {
          const currentMax = Math.max(...this.latestTeamsData.map(t => t.totalPoints), 1)
          this.playBroadcastPointsRoll(this.latestTeamsData, currentMax)
        }
      }, 30000)
    }
  }

  playBroadcastPointsRoll(teams, maxPoints) {
    if (!teams || teams.length === 0) return

    // Sort descending by points (Rank 1 leader, Rank 2, Rank 3)
    const sorted = [...teams].sort((a, b) => b.totalPoints - a.totalPoints)
    const t1 = sorted[0]
    const t2 = sorted[1] || t1
    const t3 = sorted[2] || t2

    // 3-Stage Elimination Odometer Timeline (Smooth, Controlled Velocity):
    // Team 3 (Lowest): Spins 1 cycle, finishes and locks first at 2.8s!
    // Team 2 (Middle): Spins 2 cycles, finishes and locks second at 4.2s!
    // Team 1 (Leader): Spins 3 cycles, rolls alone and finishes last at 5.6s with gentle, steady pace and very slow finish!
    const stages = [
      { team: t3, duration: 2.8, baseCycles: 1 },
      { team: t2, duration: 4.2, baseCycles: 2 },
      { team: t1, duration: 5.6, baseCycles: 3 }
    ]

    stages.forEach(({ team, duration, baseCycles }) => {
      const el = document.getElementById(`pts-count-${team.id}`)
      if (el) {
        this.renderOdometer(el, team.totalPoints, duration, baseCycles)
      }

      // Synchronized progress bar glide with smooth balanced curve
      const bar = document.getElementById(`bar-fill-${team.id}`)
      const percent = Math.min(Math.round((team.totalPoints / maxPoints) * 100), 100)
      if (bar) {
        bar.style.transition = 'none'
        bar.style.width = '0%'
        void bar.offsetWidth // Force reflow
        bar.style.transition = `width ${duration}s cubic-bezier(0.45, 0.05, 0.2, 1)`
        bar.style.width = `${percent}%`
      }
    })
  }

  renderOdometer(container, targetNumber, totalDuration = 3.6, baseCycles = 3) {
    if (!container) return
    const formatted = Number(targetNumber).toLocaleString()
    const chars = formatted.split('')

    let digitCounter = 0
    const totalDigits = chars.filter(c => /\d/.test(c)).length

    container.classList.remove('number-settled')
    container.classList.add('is-rolling')

    // Stagger step so rightmost digit finishes at exact totalDuration
    const staggerStep = totalDigits > 1 ? 0.38 : 0
    const startDuration = Math.max(1.4, totalDuration - ((totalDigits - 1) * staggerStep))

    container.innerHTML = `<div class="odometer-wrap">` + chars.map((char) => {
      if (!/\d/.test(char)) {
        return `<span class="odometer-sep">${char}</span>`
      }

      const digit = parseInt(char, 10)
      const currentIdx = digitCounter++
      // Spin cycles: Leftmost spins baseCycles, rightmost spins baseCycles + extra
      const cycles = baseCycles + currentIdx
      const finalStep = cycles * 10 + digit
      const duration = startDuration + (currentIdx * staggerStep)

      let ribbonSpans = ''
      for (let c = 0; c <= cycles + 1; c++) {
        for (let d = 0; d <= 9; d++) {
          ribbonSpans += `<span class="odometer-num">${d}</span>`
        }
      }

      return `
        <span class="odometer-col">
          <span class="odometer-ribbon" 
                data-final-step="${finalStep}" 
                style="--roll-duration: ${duration.toFixed(2)}s;">
            ${ribbonSpans}
          </span>
        </span>
      `
    }).join('') + `</div>`

    // Kick off translateY animation on all ribbons
    requestAnimationFrame(() => {
      const ribbons = container.querySelectorAll('.odometer-ribbon')
      ribbons.forEach(ribbon => {
        const step = parseInt(ribbon.getAttribute('data-final-step'), 10)
        void ribbon.offsetHeight // force reflow
        ribbon.style.transform = `translateY(-${step * 1.05}em)`
      })

      // When final column finishes
      setTimeout(() => {
        container.classList.remove('is-rolling')
        container.classList.add('number-settled')
        setTimeout(() => container.classList.remove('number-settled'), 800)
      }, totalDuration * 1000)
    })
  }

  async fetchLatestWinnerAnnouncement() {
    if (!this.supabase || !this.dom.dbLatestWinnerName) return

    try {
      const { data } = await this.supabase
        .from('competition_results')
        .select(`
          position, grade,
          competitions(name),
          participants(name, chess_number, teams(name))
        `)
        .eq('published', true)
        .eq('position', 1)
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (data && data.participants && data.competitions) {
        const p = data.participants
        const c = data.competitions
        this.dom.dbLatestWinnerName.textContent = `🏆 ${p.name.toUpperCase()} (#${p.chess_number}) • ${p.teams?.name || ''} — 1st in ${c.name}`
      }
    } catch (e) {}
  }

  // --------------------------------------------------------------------------
  // MILESTONE POSTER PRELOAD & SEAMLESS ROTATION ENGINE
  // --------------------------------------------------------------------------
  async preloadImage(url) {
    if (!url) return null
    if (this.preloadedPosterCache.has(url)) return url

    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = async () => {
        if ('decode' in img) {
          try {
            await img.decode()
          } catch (e) {}
        }
        this.preloadedPosterCache.set(url, true)
        console.log('✅ Milestone Poster decoded into RAM cache:', url)
        resolve(url)
      }
      img.onerror = () => {
        console.warn('Could not load milestone poster image:', url)
        resolve(null)
      }
      img.src = url
    })
  }

  async handleMilestonePoster(rawUrl) {
    if (this.activeMilestonePosterUrl === rawUrl) return

    // Preload fully in memory first before touching screen (Zero chunking / Zero blank)
    const readyUrl = await this.preloadImage(rawUrl)
    if (!readyUrl) {
      this.clearMilestonePoster()
      return
    }

    this.activeMilestonePosterUrl = readyUrl
    if (this.dom.dashboardPosterImg) {
      this.dom.dashboardPosterImg.src = readyUrl
    }

    // Start automated broadcast loop between Live Standings (20s) and Full-Screen Poster (20s)
    this.startDashboardPosterRotation()
  }

  clearMilestonePoster() {
    this.activeMilestonePosterUrl = null
    if (this.posterRotationTimer) {
      clearTimeout(this.posterRotationTimer)
      this.posterRotationTimer = null
    }
    if (this.dom.dashboardPosterShowcase) {
      this.dom.dashboardPosterShowcase.classList.remove('active')
    }
  }

  startDashboardPosterRotation() {
    if (this.posterRotationTimer) {
      clearTimeout(this.posterRotationTimer)
      this.posterRotationTimer = null
    }

    // Initial cycle: 18s on Standings (with 5.6s roll) -> then Fullscreen Poster
    this.scheduleNextBroadcastPhase(false, 18000)
  }

  scheduleNextBroadcastPhase(showingPoster, delayMs) {
    if (this.posterRotationTimer) {
      clearTimeout(this.posterRotationTimer)
    }

    this.posterRotationTimer = setTimeout(() => {
      if (this.currentView !== 'dashboard' || !this.activeMilestonePosterUrl || this.isAnnouncementActive || this.isSlideshowActive || this.isVideoPlaying) {
        // Reschedule check in 5s if announcement, slideshow, or video is active
        this.scheduleNextBroadcastPhase(showingPoster, 5000)
        return
      }

      const nextShowingPoster = !showingPoster
      this.toggleDashboardPosterDisplay(nextShowingPoster)

      // 20s on Full Screen Poster <-> 20s on Live Standings
      const nextDuration = nextShowingPoster ? 20000 : 20000
      this.scheduleNextBroadcastPhase(nextShowingPoster, nextDuration)
    }, delayMs)
  }

  toggleDashboardPosterDisplay(showPoster) {
    if (!this.dom.dashboardPosterShowcase) return

    if (showPoster && this.activeMilestonePosterUrl && !this.isAnnouncementActive) {
      // Full Screen Clean Poster (No text overlay)
      this.dom.dashboardPosterShowcase.classList.add('active')
    } else {
      // Return to Live Standings
      this.dom.dashboardPosterShowcase.classList.remove('active')
      setTimeout(() => {
        if (this.latestTeamsData && this.latestTeamsData.length > 0 && !this.isAnnouncementActive) {
          const currentMax = Math.max(...this.latestTeamsData.map(t => t.totalPoints), 1)
          this.playBroadcastPointsRoll(this.latestTeamsData, currentMax)
        }
      }, 400)
    }
  }

  handleTvRemoteState(state) {
    if (!state) return

    // 0. Remote Hard Refresh / Cache-Busted Reload from Admin Phone
    if (state.force_refresh) {
      if (!this.lastHandledForceRefresh) {
        this.lastHandledForceRefresh = Number(state.force_refresh)
      } else if (Number(state.force_refresh) > this.lastHandledForceRefresh) {
        console.log('🔄 Remote Force Hard-Refresh received from phone! Performing full cache-busted reload...')
        this.lastHandledForceRefresh = Number(state.force_refresh)
        const cleanUrl = window.location.href.split('?')[0].split('#')[0]
        window.location.href = `${cleanUrl}?_hardRefresh=${Date.now()}`
        return
      }
    }

    // 1. Blackout screen handling
    const isBlank = Boolean(state.blank_screen)
    if (this.dom.tvBlackoutOverlay) {
      this.dom.tvBlackoutOverlay.classList.toggle('active', isBlank)
    }

    // 2. Full-Screen Remote Video Broadcast handling
    const videoMode = state.video_mode
    const isVideoActive = Boolean(videoMode && videoMode.active && videoMode.url)

    // 3. Full-Screen Gallery Slideshow handling
    const slideshowMode = state.slideshow_mode
    const isSlideshowWanted = Boolean(slideshowMode && slideshowMode.active)

    if (isVideoActive) {
      // If video is active, slideshow must be stopped
      if (this.isSlideshowActive || this.wasSlideshowActiveBeforeAnnouncement) {
        this.stopGallerySlideshow()
      }
      this.playRemoteVideo(videoMode)
    } else {
      this.stopRemoteVideo()

      // If video is not active, run slideshow if wanted
      if (isSlideshowWanted) {
        if (!this.isSlideshowActive && !this.wasSlideshowActiveBeforeAnnouncement) {
          this.startGallerySlideshow(slideshowMode.speed || 7)
        }
      } else {
        if (this.isSlideshowActive || this.wasSlideshowActiveBeforeAnnouncement) {
          this.stopGallerySlideshow()
        }
      }
    }
  }

  playRemoteVideo(videoMode) {
    if (!this.dom.tvVideoPlayer || !this.dom.tvVideoOverlay) return

    let targetUrl = (videoMode.url || '').trim()

    // Transform Google Drive Share URLs to direct streaming links automatically
    if (targetUrl.includes('drive.google.com')) {
      const match = targetUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || targetUrl.match(/id=([a-zA-Z0-9_-]+)/)
      if (match && match[1]) {
        targetUrl = `https://drive.google.com/uc?export=download&id=${match[1]}`
      }
    }

    const isLoop = videoMode.loop !== false
    const isMuted = Boolean(videoMode.muted)

    // If already playing this exact video, just sync mute/loop
    if (this.isVideoPlaying && this.currentPlayingVideoUrl === targetUrl) {
      this.dom.tvVideoPlayer.muted = isMuted
      this.dom.tvVideoPlayer.loop = isLoop
      return
    }

    console.log('🎬 Starting Zero-Buffer Video Broadcast on TV:', targetUrl)
    this.currentPlayingVideoUrl = targetUrl

    const player = this.dom.tvVideoPlayer
    player.pause()
    player.src = targetUrl
    player.muted = isMuted
    player.loop = isLoop
    player.currentTime = 0

    // Show Loader until buffered enough to guarantee zero stutter
    if (this.dom.tvVideoLoader) {
      this.dom.tvVideoLoader.classList.add('active')
      if (this.dom.tvVideoLoaderText) {
        this.dom.tvVideoLoaderText.textContent = 'Buffering Video into Memory...'
      }
    }

    player.oncanplay = () => {
      console.log('✅ Video buffer ready! Launching fullscreen hardware playback...')
      if (this.dom.tvVideoLoader) {
        this.dom.tvVideoLoader.classList.remove('active')
      }
      this.dom.tvVideoOverlay.classList.add('active')
      this.isVideoPlaying = true

      // Play with hardware acceleration
      player.play().catch(err => {
        console.warn('Auto-play muted fallback triggered:', err)
        player.muted = true
        player.play().catch(e => console.error('Video playback failed:', e))
      })
    }

    player.onerror = (e) => {
      console.error('❌ Error playing video:', e)
      if (this.dom.tvVideoLoader) {
        this.dom.tvVideoLoader.classList.remove('active')
      }
      if (this.dom.tvVideoOverlay) {
        this.dom.tvVideoOverlay.classList.remove('active')
      }
      this.isVideoPlaying = false
      this.currentPlayingVideoUrl = null
      this.showToast('⚠️ Video could not be played, check link')
    }

    player.onended = () => {
      if (!isLoop) {
        console.log('🏁 Video finished -> returning to standings')
        this.stopRemoteVideo()
      }
    }
  }

  stopRemoteVideo() {
    this.isVideoPlaying = false
    this.currentPlayingVideoUrl = null
    this.wasVideoPlayingBeforeAnnouncement = false

    if (this.dom.tvVideoPlayer) {
      try {
        this.dom.tvVideoPlayer.pause()
        this.dom.tvVideoPlayer.removeAttribute('src')
        this.dom.tvVideoPlayer.load()
      } catch (e) {}
    }

    if (this.dom.tvVideoLoader) {
      this.dom.tvVideoLoader.classList.remove('active')
    }

    if (this.dom.tvVideoOverlay) {
      this.dom.tvVideoOverlay.classList.remove('active')
    }
  }

  // --------------------------------------------------------------------------
  // CINEMATIC GALLERY PHOTO SLIDESHOW ENGINE (Ken Burns 60 FPS)
  // --------------------------------------------------------------------------
  async fetchGallerySlideshowPhotos() {
    if (!this.supabase) return []
    try {
      const { data, error } = await this.supabase
        .from('gallery_media')
        .select('id, hd_url, thumb_url, created_at')
        .is('milestone', null)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error || !data) return []
      return data
    } catch (e) {
      console.warn('Error fetching gallery slideshow photos:', e)
      return []
    }
  }

  async startGallerySlideshow(speedSeconds = 7) {
    if (this.isSlideshowActive || this.wasSlideshowActiveBeforeAnnouncement) return
    console.log('📸 Starting Cinematic Gallery Slideshow on TV, speed:', speedSeconds, 's')

    this.isSlideshowActive = true
    this.currentSlideshowSpeed = speedSeconds

    // Fetch photos if not yet cached in RAM
    if (!this.slideshowPhotos || this.slideshowPhotos.length === 0) {
      this.slideshowPhotos = await this.fetchGallerySlideshowPhotos()
    }

    if (this.slideshowPhotos.length === 0) {
      console.warn('No event photos found in gallery_media for slideshow')
      this.showToast('No gallery photos available yet')
      this.isSlideshowActive = false
      return
    }

    // Always restore last position from localStorage so it continues from the remaining photos
    let restoredIdx = -1
    try {
      const savedId = localStorage.getItem('inspico_slideshow_last_id')
      const savedUrl = localStorage.getItem('inspico_slideshow_last_url')
      const savedIdx = localStorage.getItem('inspico_slideshow_last_idx')

      if (savedId) {
        restoredIdx = this.slideshowPhotos.findIndex(p => p.id === savedId)
      }
      if (restoredIdx === -1 && savedUrl) {
        restoredIdx = this.slideshowPhotos.findIndex(p => (p.hd_url === savedUrl || p.thumb_url === savedUrl))
      }
      if (restoredIdx === -1 && savedIdx !== null) {
        const parsed = parseInt(savedIdx, 10)
        if (!isNaN(parsed) && parsed >= 0) {
          restoredIdx = parsed % this.slideshowPhotos.length
        }
      }
    } catch (e) {}

    if (restoredIdx !== -1) {
      // Advance to the remaining next slide!
      this.slideshowIndex = (restoredIdx + 1) % this.slideshowPhotos.length
      console.log(`📍 Resuming slideshow from remaining photo: #${this.slideshowIndex + 1} of ${this.slideshowPhotos.length}`)
    } else if (this.slideshowIndex === undefined || this.slideshowIndex === null) {
      this.slideshowIndex = 0
    }

    if (this.dom.tvSlideshowOverlay) {
      this.dom.tvSlideshowOverlay.classList.add('active')
    }

    this.currentSlideSlot = this.currentSlideSlot || 'A'
    await this.renderCurrentSlideshowSlide()

    if (this.slideshowInterval) clearInterval(this.slideshowInterval)
    this.slideshowInterval = setInterval(() => {
      if (!this.isAnnouncementActive) {
        this.nextSlideshowSlide()
      }
    }, speedSeconds * 1000)
  }

  pauseGallerySlideshow() {
    if (!this.isSlideshowActive) return
    console.log('⏸️ Pausing Gallery Slideshow for 20s Result Announcement. Preserving current slide index:', this.slideshowIndex)
    this.wasSlideshowActiveBeforeAnnouncement = true
    this.isSlideshowActive = false

    if (this.slideshowInterval) {
      clearInterval(this.slideshowInterval)
      this.slideshowInterval = null
    }

    if (this.dom.tvSlideshowOverlay) {
      this.dom.tvSlideshowOverlay.classList.remove('active')
    }
  }

  resumeGallerySlideshow() {
    if (!this.wasSlideshowActiveBeforeAnnouncement) return
    console.log('▶️ Resuming Gallery Slideshow from where it was paused (Remaining slide). Preserved index:', this.slideshowIndex)
    this.wasSlideshowActiveBeforeAnnouncement = false
    this.isSlideshowActive = true

    if (this.dom.tvSlideshowOverlay) {
      this.dom.tvSlideshowOverlay.classList.add('active')
    }

    // Do NOT start from 0! Advance smoothly to the next remaining photo in queue
    if (this.slideshowPhotos && this.slideshowPhotos.length > 0) {
      this.nextSlideshowSlide()
    }

    const speed = this.currentSlideshowSpeed || 7
    if (this.slideshowInterval) clearInterval(this.slideshowInterval)
    this.slideshowInterval = setInterval(() => {
      if (!this.isAnnouncementActive) {
        this.nextSlideshowSlide()
      }
    }, speed * 1000)
  }

  async nextSlideshowSlide() {
    if (!this.isSlideshowActive || this.slideshowPhotos.length === 0) return

    this.slideshowIndex = (this.slideshowIndex + 1) % this.slideshowPhotos.length
    await this.renderCurrentSlideshowSlide()
  }

  async renderCurrentSlideshowSlide() {
    const photo = this.slideshowPhotos[this.slideshowIndex]
    if (!photo) return

    const photoUrl = photo.hd_url || photo.thumb_url
    if (!photoUrl) return

    // Persist current photo progress so reload/redeploy/toggle resumes from remaining
    try {
      localStorage.setItem('inspico_slideshow_last_idx', this.slideshowIndex.toString())
      if (photo.id) {
        localStorage.setItem('inspico_slideshow_last_id', photo.id.toString())
      }
      if (photoUrl) {
        localStorage.setItem('inspico_slideshow_last_url', photoUrl)
      }
    } catch (e) {}

    // Preload into memory first (Zero blank screen)
    await this.preloadImage(photoUrl)

    const slotA = this.dom.slideshowSlideA
    const slotB = this.dom.slideshowSlideB
    if (!slotA || !slotB) return

    if (this.currentSlideSlot === 'A') {
      slotA.style.backgroundImage = `url('${photoUrl}')`
      slotA.classList.remove('visible')
      void slotA.offsetWidth // force reflow
      slotA.classList.add('visible')
      slotB.classList.remove('visible')
      this.currentSlideSlot = 'B'
    } else {
      slotB.style.backgroundImage = `url('${photoUrl}')`
      slotB.classList.remove('visible')
      void slotB.offsetWidth // force reflow
      slotB.classList.add('visible')
      slotA.classList.remove('visible')
      this.currentSlideSlot = 'A'
    }

    // Proactively preload NEXT slide in queue so it's instant!
    const nextIdx = (this.slideshowIndex + 1) % this.slideshowPhotos.length
    const nextPhoto = this.slideshowPhotos[nextIdx]
    if (nextPhoto) {
      const nextUrl = nextPhoto.hd_url || nextPhoto.thumb_url
      if (nextUrl) this.preloadImage(nextUrl)
    }
  }

  stopGallerySlideshow() {
    if (!this.isSlideshowActive && !this.wasSlideshowActiveBeforeAnnouncement) return
    console.log('⏹️ Stopping Gallery Slideshow on TV (Preserving progress for next session)')

    this.isSlideshowActive = false
    this.wasSlideshowActiveBeforeAnnouncement = false

    if (this.slideshowInterval) {
      clearInterval(this.slideshowInterval)
      this.slideshowInterval = null
    }

    if (this.dom.tvSlideshowOverlay) {
      this.dom.tvSlideshowOverlay.classList.remove('active')
    }

    if (this.dom.slideshowSlideA) this.dom.slideshowSlideA.classList.remove('visible')
    if (this.dom.slideshowSlideB) this.dom.slideshowSlideB.classList.remove('visible')
  }

  // 100% Offline Local State Poller (Ensures phone and Pi talk over WiFi with 0 internet)
  initLocalStatePoller() {
    const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname) ||
                    window.location.hostname.startsWith('192.168.') ||
                    window.location.hostname.startsWith('10.')
    if (!isLocal) return

    setInterval(async () => {
      try {
        const res = await fetch('/api/tv-state', { cache: 'no-store' })
        if (res.ok) {
          const state = await res.json()
          this.handleTvRemoteState(state)
        }
      } catch (e) {
        // Silent
      }
    }, 2000)
  }

  // --------------------------------------------------------------------------
  // BREAKING LIVE RESULT ANNOUNCEMENT ENGINE (20s Auto-Display)
  // --------------------------------------------------------------------------
  async initPublishedResultHistory() {
    this.seenPublishedCompIds = new Set()
    if (!this.supabase) return
    try {
      const { data } = await this.supabase
        .from('competition_results')
        .select('competition_id')
        .eq('published', true)
      if (data) {
        data.forEach(r => {
          if (r.competition_id) this.seenPublishedCompIds.add(r.competition_id)
        })
      }
      this.hasInitializedHistory = true
    } catch (e) {
      console.warn('Error fetching published competition history:', e)
      this.hasInitializedHistory = true
    }
  }

  initRealtimeResultListener() {
    if (!this.supabase) return
    try {
      if (this.realtimeChannel) {
        this.supabase.removeChannel(this.realtimeChannel)
      }

      this.realtimeChannel = this.supabase
        .channel('public:realtime_competition_results')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'competition_results' }, (payload) => {
          console.log('⚡ Instant Realtime publish event received:', payload)
          const compId = payload?.new?.competition_id || payload?.old?.competition_id
          if (compId && payload?.new?.published) {
            this.fetchAndAnnounceCompetition(compId)
          } else {
            this.checkForNewlyPublishedCompetitions()
          }
          this.fetchDashboardPoints()
          this.fetchStandbyData()
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'competitions' }, () => {
          this.checkForNewlyPublishedCompetitions()
          this.fetchDashboardPoints()
          this.fetchStandbyData()
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, (payload) => {
          console.log('⚡ Instant Realtime app_settings updated (Leaderboard Milestone / Colors):', payload)
          this.fetchDashboardPoints()
          this.fetchStandbyData()
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'gallery_media' }, () => {
          console.log('⚡ Instant Realtime gallery_media milestone poster updated')
          this.fetchDashboardPoints()
        })
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Realtime WebSocket connected! Instant 0ms result announcements active.')
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            console.warn('⚠️ Realtime WebSocket disconnected, reconnecting in 5s...', err)
            setTimeout(() => this.initRealtimeResultListener(), 5000)
          }
        })
    } catch (e) {
      console.warn('Realtime subscription error:', e)
    }
  }

  async fetchAndAnnounceCompetition(compId) {
    if (!compId || this.seenPublishedCompIds.has(compId)) return
    this.seenPublishedCompIds.add(compId)

    try {
      const { data: results, error } = await this.supabase
        .from('competition_results')
        .select(`
          id, position, grade, placement_points, grade_points, published_at, competition_id,
          participants(id, name, chess_number, teams(id, name)),
          competitions(id, name, competition_type)
        `)
        .eq('competition_id', compId)
        .eq('published', true)

      if (error || !results || results.length === 0) return

      const compName = results[0]?.competitions?.name || 'Competition Result'
      const compCategory = results[0]?.competitions?.competition_type || 'Arts Festival'

      this.enqueueResultAnnouncement(compName, compCategory, results)
    } catch (e) {
      console.warn('Error fetching instant competition announcement:', e)
    }
  }

  async checkForNewlyPublishedCompetitions() {
    if (!this.supabase || !this.hasInitializedHistory) return

    try {
      const { data: recentWins, error } = await this.supabase
        .from('competition_results')
        .select(`
          id, position, grade, placement_points, grade_points, published_at, competition_id,
          participants(id, name, chess_number, teams(id, name)),
          competitions(id, name, competition_type)
        `)
        .eq('published', true)
        .order('published_at', { ascending: false })
        .limit(30)

      if (error || !recentWins || recentWins.length === 0) return

      // Find any newly published competition not in seen history
      const newCompMap = {}
      for (const r of recentWins) {
        if (r.competition_id && !this.seenPublishedCompIds.has(r.competition_id)) {
          if (!newCompMap[r.competition_id]) {
            newCompMap[r.competition_id] = {
              compName: r.competitions?.name || 'Competition Result',
              compCategory: r.competitions?.competition_type || 'Arts Festival',
              results: []
            }
          }
          newCompMap[r.competition_id].results.push(r)
        }
      }

      const newCompIds = Object.keys(newCompMap)
      if (newCompIds.length > 0) {
        newCompIds.forEach(id => {
          this.seenPublishedCompIds.add(id)
          const compData = newCompMap[id]
          this.enqueueResultAnnouncement(compData.compName, compData.compCategory, compData.results)
        })
      }
    } catch (e) {
      console.warn('Error checking newly published competitions:', e)
    }
  }

  enqueueResultAnnouncement(compName, compCategory, results, resultNumber = null) {
    const item = { compName, compCategory, results, resultNumber }
    if (this.isAnnouncementActive) {
      console.log('📥 Announcement currently active -> Enqueued result:', compName)
      if (!this.announcementQueue) this.announcementQueue = []
      this.announcementQueue.push(item)
      return
    }
    this.triggerBreakingResultAnnouncement(item.compName, item.compCategory, item.results, item.resultNumber)
  }

  triggerBreakingResultAnnouncement(compName, compCategory, results, resultNumber = null) {
    if (!this.dom.resultAnnouncementOverlay) return
    this.isAnnouncementActive = true

    if (this.dom.announcementCompTitle) {
      this.dom.announcementCompTitle.textContent = (compName || 'COMPETITION RESULT').toUpperCase()
    }
    if (this.dom.announcementCompCategory) {
      this.dom.announcementCompCategory.textContent = `${compCategory ? compCategory.toUpperCase() + ' • ' : ''}RESULT PUBLISHED`
    }

    // Determine Result Number
    if (!resultNumber && results && results.length > 0) {
      const compId = results[0].competition_id
      if (this.announcerSeqCompIds && this.announcerSeqCompIds.length > 0) {
        const idx = this.announcerSeqCompIds.indexOf(compId)
        if (idx !== -1) {
          resultNumber = idx + 1
        }
      }
    }

    const numEl = document.getElementById('announcementResultNumberText')
    if (numEl) {
      numEl.textContent = resultNumber ? `${resultNumber}` : '--'
    }

    // Sort winners: 1st, 2nd, 3rd
    const sorted = [...(results || [])].filter(r => r.position && r.position > 0).sort((a, b) => a.position - b.position)

    const defaultColors = {
      'Sharqawi': '#ff4757',
      'Zahrawi': '#e056fd',
      'Barmawi': '#1e90ff'
    }

    let podiumHtml = ''
    if (sorted.length > 0) {
      podiumHtml = sorted.slice(0, 3).map(r => {
        const pos = r.position || 1
        const posClass = `pos-${pos}`
        let posLabel = '🥇 1ST PLACE'
        if (pos === 2) posLabel = '🥈 2ND PLACE'
        else if (pos === 3) posLabel = '🥉 3RD PLACE'

        const student = r.participants?.name || 'Participant'
        const teamName = r.participants?.teams?.name || 'Team'
        const teamColor = defaultColors[teamName] || '#B8193C'
        const grade = r.grade ? `GRADE ${r.grade}` : ''

        return `
          <div class="ann-winner-card ${posClass}">
            <div class="ann-rank-badge">${posLabel}</div>
            <div class="ann-student-name">${this.escapeHtml(student)}</div>
            <div class="ann-team-pill" style="--team-col: ${teamColor};">
              <span class="ann-team-dot" style="background: ${teamColor};"></span>
              <span>${this.escapeHtml(teamName)}</span>
            </div>
            ${grade ? `<div class="ann-grade-tag">${this.escapeHtml(grade)}</div>` : ''}
          </div>
        `
      }).join('')
    } else {
      podiumHtml = `
        <div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: rgba(255,255,255,0.7); font-size: 20px;">
          Competition Result Announced
        </div>
      `
    }

    if (this.dom.announcementPodiumGrid) {
      this.dom.announcementPodiumGrid.innerHTML = podiumHtml
    }

    // Pause video if currently playing on TV during breaking result announcement
    if (this.isVideoPlaying && this.dom.tvVideoPlayer && !this.dom.tvVideoPlayer.paused) {
      this.dom.tvVideoPlayer.pause()
      this.wasVideoPlayingBeforeAnnouncement = true
    }

    // Pause slideshow temporarily during breaking result announcement (preserves current slide position)
    if (this.isSlideshowActive) {
      this.pauseGallerySlideshow()
    }

    // Show Overlay
    this.dom.resultAnnouncementOverlay.classList.add('active')

    // Restart Progress Bar CSS animation cleanly for fresh 20s
    if (this.dom.announcementProgressBar) {
      this.dom.announcementProgressBar.style.animation = 'none'
      void this.dom.announcementProgressBar.offsetWidth // force reflow
      this.dom.announcementProgressBar.style.animation = 'announcementTimerBar 20s linear forwards'
    }

    // Audio chime
    this.playChime()

    if (this.announcementCountdownTimeout) {
      clearTimeout(this.announcementCountdownTimeout)
    }

    // Auto-close overlay after exactly 20 seconds
    console.log('⏰ Starting 20s auto-dismiss timer for result announcement...')
    this.announcementCountdownTimeout = setTimeout(() => {
      console.log('🚪 20s timeout reached -> Next in queue or close')
      this.closeResultAnnouncement()
    }, 20000)
  }

  closeResultAnnouncement() {
    console.log('🚪 closeResultAnnouncement executed')
    if (this.announcementCountdownTimeout) {
      clearTimeout(this.announcementCountdownTimeout)
      this.announcementCountdownTimeout = null
    }

    // Check if there are more announcements waiting in the FIFO queue!
    if (this.announcementQueue && this.announcementQueue.length > 0) {
      const nextItem = this.announcementQueue.shift()
      console.log('⏩ Playing next queued result announcement with full 20s:', nextItem.compName)
      this.triggerBreakingResultAnnouncement(nextItem.compName, nextItem.compCategory, nextItem.results, nextItem.resultNumber)
      return
    }

    if (this.dom.resultAnnouncementOverlay) {
      this.dom.resultAnnouncementOverlay.classList.remove('active')
    }

    this.isAnnouncementActive = false

    // Resume video playback if video was active prior to announcement
    if (this.wasVideoPlayingBeforeAnnouncement && this.isVideoPlaying && this.dom.tvVideoPlayer) {
      console.log('▶️ Resuming video playback after result announcements completed')
      this.dom.tvVideoPlayer.play().catch(() => {})
      this.wasVideoPlayingBeforeAnnouncement = false
    }

    // Resume gallery slideshow smoothly from next remaining photo
    if (this.wasSlideshowActiveBeforeAnnouncement) {
      console.log('📸 Resuming gallery slideshow from current position after result announcements completed')
      this.resumeGallerySlideshow()
    }

    // Refresh standings & replay points roll with newly published points
    this.fetchDashboardPoints()
    this.fetchStandbyData()
  }

  async testResultAnnouncement() {
    if (!this.supabase) {
      this.showToast('Database connection not ready')
      return
    }

    try {
      this.showToast('Loading latest published competition...')

      // 1. Find the latest published competition_id
      const { data: latestRow, error: err1 } = await this.supabase
        .from('competition_results')
        .select('competition_id')
        .eq('published', true)
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (err1 || !latestRow || !latestRow.competition_id) {
        this.showToast('No published results found in database yet.')
        return
      }

      const compId = latestRow.competition_id

      // 2. Fetch all winners and details for this latest competition
      const { data: results, error: err2 } = await this.supabase
        .from('competition_results')
        .select(`
          id, position, grade, placement_points, grade_points, published_at, competition_id,
          participants(id, name, chess_number, teams(id, name)),
          competitions(id, name, competition_type)
        `)
        .eq('competition_id', compId)
        .eq('published', true)

      if (err2 || !results || results.length === 0) {
        this.showToast('Could not load winners for latest competition.')
        return
      }

      const compName = results[0]?.competitions?.name || 'Competition Result'
      const compCategory = results[0]?.competitions?.competition_type || 'Arts Festival'

      // 3. Mark as seen to prevent auto-reopen loop from background sync
      this.seenPublishedCompIds.add(compId)

      // 4. Trigger 20-second Breaking Result Announcement with REAL data from database
      this.triggerBreakingResultAnnouncement(compName, compCategory, results)

    } catch (e) {
      console.error('Error fetching real latest announcement:', e)
      this.showToast('Error loading latest announcement')
    }
  }

  startDashboardSync() {
    if (this.dashboardSyncInterval) {
      clearInterval(this.dashboardSyncInterval)
    }
    // Smart Low-Egress Fallback (45s) - 0ms Realtime WebSocket already handles all live updates with zero polling load!
    this.dashboardSyncInterval = setInterval(() => {
      if (this.currentView === 'dashboard') {
        this.fetchDashboardPoints()
      }
      this.checkForNewlyPublishedCompetitions()
    }, 45000)
  }

  async fetchStandbyData() {
    if (!this.supabase) return

    try {
      // 1. Fetch Summary Stats
      const [partsRes, compsRes, resultsRes] = await Promise.all([
        this.supabase.from('participants').select('id', { count: 'exact', head: true }),
        this.supabase.from('competitions').select('id', { count: 'exact', head: true }),
        this.supabase.from('competition_results').select('competition_id').eq('published', true)
      ])

      if (partsRes.count !== null && this.dom.statParticipants) {
        this.dom.statParticipants.textContent = partsRes.count
      }
      if (compsRes.count !== null && this.dom.statCompetitions) {
        this.dom.statCompetitions.textContent = compsRes.count
      }
      if (resultsRes.data && this.dom.statPublished) {
        const uniqueComps = new Set(resultsRes.data.map(r => r.competition_id))
        this.dom.statPublished.textContent = uniqueComps.size
      }

      // 2. Fetch Latest Published Results with Winners
      const { data: recentWins, error } = await this.supabase
        .from('competition_results')
        .select(`
          id, position, grade, avg_points, placement_points, grade_points, published_at,
          participants(id, name, chess_number, teams(name)),
          competitions(id, name)
        `)
        .eq('published', true)
        .order('published_at', { ascending: false })
        .limit(10)

      if (error) throw error

      this.renderRecentResults(recentWins || [])
    } catch (err) {
      console.error('Error fetching standby data:', err)
      if (this.dom.recentResultsList) {
        this.dom.recentResultsList.innerHTML = `
          <div style="padding: 20px; text-align: center; color: rgba(255, 255, 255, 0.4); font-size: 13px;">
            Ready to scan chest QR codes.
          </div>
        `
      }
    }
  }

  renderRecentResults(results) {
    if (!this.dom.recentResultsList) return

    if (!results || results.length === 0) {
      this.dom.recentResultsList.innerHTML = `
        <div style="padding: 20px; text-align: center; color: rgba(255, 255, 255, 0.4); font-size: 13px;">
          No published results announced yet.
        </div>
      `
      return
    }

    this.dom.recentResultsList.innerHTML = results.map(r => {
      const pos = r.position || 0
      let posText = `Pos ${pos}`
      let posClass = ''
      if (pos === 1) { posText = '🥇 1st Place'; posClass = 'pos-1'; }
      else if (pos === 2) { posText = '🥈 2nd Place'; posClass = 'pos-2'; }
      else if (pos === 3) { posText = '🥉 3rd Place'; posClass = 'pos-3'; }

      const compName = r.competitions?.name || 'Competition'
      const studentName = r.participants?.name || 'Participant'
      const chestNo = r.participants?.chess_number || '-'
      const team = r.participants?.teams?.name || ''

      return `
        <div class="recent-res-item" onclick="window.app.searchChestNumber('${chestNo}')" style="cursor: pointer;">
          <div class="res-comp-info">
            <span class="res-comp-name">${this.escapeHtml(compName)}</span>
            <span class="res-winner-info">
              <span class="res-chest-tag">#${chestNo}</span>
              <span>${this.escapeHtml(studentName)}</span>
              ${team ? `<span style="opacity: 0.6;">(${this.escapeHtml(team)})</span>` : ''}
            </span>
          </div>
          <div class="res-place-badge ${posClass}">
            <span>${posText}</span>
          </div>
        </div>
      `
    }).join('')
  }

  // --------------------------------------------------------------------------
  // PARTICIPANT SEARCH & DATA RETRIEVAL
  // --------------------------------------------------------------------------
  async searchChestNumber(chestNo) {
    if (!chestNo || !this.supabase) return

    const cleanChest = chestNo.toString().trim()
    if (!cleanChest) return

    this.showLoading(`Loading Chest #${cleanChest}...`)

    try {
      // 1. Fetch Participant Profile
      const { data: part, error: partError } = await this.supabase
        .from('participants')
        .select('id, name, chess_number, teams(name), categories(name)')
        .ilike('chess_number', cleanChest)
        .maybeSingle()

      if (partError) throw partError

      if (!part) {
        this.hideLoading()
        this.showToast(`No participant found for Chest #${cleanChest}`)
        return
      }

      this.currentParticipant = part
      this.playChime()

      // Add to recent history (avoid duplicates)
      this.scanHistory = [part.chess_number, ...this.scanHistory.filter(c => c !== part.chess_number)].slice(0, 5)
      this.renderHistoryPills()

      // 2. Fetch Registered Competitions
      const { data: regs, error: regsError } = await this.supabase
        .from('competition_participants')
        .select(`
          competition_id,
          competitions(
            id, name, competition_type,
            stages(name),
            competition_schedule(scheduled_date, estimated_duration_mins)
          )
        `)
        .eq('participant_id', part.id)

      if (regsError) console.warn('Error fetching regs:', regsError)
      this.currentRegistrations = regs || []

      // 3. Fetch Published Results for this Participant
      const { data: results, error: resError } = await this.supabase
        .from('competition_results')
        .select('id, competition_id, position, grade, avg_points, placement_points, grade_points, published')
        .eq('participant_id', part.id)
        .eq('published', true)

      if (resError) console.warn('Error fetching results:', resError)
      this.currentResults = results || []

      // Render View
      this.renderParticipantView()
      this.switchView('result')
      this.hideLoading()

      // Start Auto-Standby countdown timer
      this.startCountdown()

    } catch (err) {
      console.error('Error fetching participant data:', err)
      this.hideLoading()
      this.showToast('Failed to load participant data. Check network connection.')
    }
  }

  // --------------------------------------------------------------------------
  // RENDER PARTICIPANT & COMPETITIONS
  // --------------------------------------------------------------------------
  renderParticipantView() {
    const p = this.currentParticipant
    if (!p) return

    // Update Left Sidebar Actual Scaled Chest Card
    this.dom.resChestNo.textContent = p.chess_number || '---'
    this.dom.resName.textContent = (p.name || '---').toUpperCase()
    this.dom.resTeam.textContent = (p.teams?.name || 'GENERAL').toUpperCase()
    this.dom.resCategory.textContent = (p.categories?.name || 'OPEN').toUpperCase()

    // Update real QR code in the chest card
    const qrImg = document.getElementById('chestCardQrImg')
    if (qrImg) {
      const qrData = `${window.location.origin}/#${p.chess_number || ''}`
      qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=197x197&margin=0&data=${encodeURIComponent(qrData)}`
    }

    // Calculate Summary Stats
    const totalEvents = this.currentRegistrations.length
    let totalPoints = 0
    let topPlacesCount = 0

    const resultsMap = {}
    this.currentResults.forEach(r => {
      resultsMap[r.competition_id] = r
      const pts = (r.placement_points || 0) + (r.grade_points || 0)
      totalPoints += pts
      if (r.position && r.position <= 3) {
        topPlacesCount++
      }
    })

    this.dom.resTotalEvents.textContent = totalEvents
    this.dom.resTotalPoints.textContent = totalPoints
    this.dom.resTopPlaces.textContent = topPlacesCount

    // Update Tab Counts
    const publishedCount = this.currentResults.length
    const scheduledCount = Math.max(0, totalEvents - publishedCount)
    this.dom.countAllEvents.textContent = totalEvents
    this.dom.countPublishedEvents.textContent = publishedCount
    this.dom.countScheduledEvents.textContent = scheduledCount

    // Render Event Cards
    this.renderCompetitionsList(resultsMap)
  }

  renderCompetitionsList(resultsMap = {}) {
    const container = this.dom.competitionsListCards
    if (!container) return

    if (!this.currentRegistrations || this.currentRegistrations.length === 0) {
      container.innerHTML = `
        <div style="padding: 40px; text-align: center; color: rgba(255, 255, 255, 0.4); font-size: 16px;">
          No registered competitions found for this participant.
        </div>
      `
      return
    }

    const filtered = this.currentRegistrations.filter(r => {
      const compId = r.competitions?.id
      const hasResult = !!resultsMap[compId]
      if (this.currentFilter === 'results') return hasResult
      if (this.currentFilter === 'scheduled') return !hasResult
      return true
    })

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="padding: 40px; text-align: center; color: rgba(255, 255, 255, 0.4); font-size: 16px;">
          No competitions matching current filter.
        </div>
      `
      return
    }

    container.innerHTML = filtered.map((r, index) => {
      const c = r.competitions || {}
      const compId = c.id
      const result = resultsMap[compId]
      const isStage = c.competition_type === 'stage'
      const stageName = c.stages?.name || (isStage ? 'Stage Assigned' : 'Off-Stage')
      
      const sched = Array.isArray(c.competition_schedule) ? c.competition_schedule[0] : c.competition_schedule
      const schedDate = sched?.scheduled_date
        ? new Date(sched.scheduled_date).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' })
        : null
      const schedDur = sched?.estimated_duration_mins ? `${sched.estimated_duration_mins} mins` : null

      // Result Plaque HTML matching V1
      let resultHtml = ''
      let cardModifier = ''

      if (result) {
        const pos = result.position
        let posClass = 'participated'
        let emoji = '🎗️'
        let label = 'PARTICIPANT'

        if (pos === 1) {
          posClass = 'rank-1'
          emoji = '🥇'
          label = '1ST PLACE'
          cardModifier = 'has-result gold-pos'
        } else if (pos === 2) {
          posClass = 'rank-2'
          emoji = '🥈'
          label = '2ND PLACE'
          cardModifier = 'has-result silver-pos'
        } else if (pos === 3) {
          posClass = 'rank-3'
          emoji = '🥉'
          label = '3RD PLACE'
          cardModifier = 'has-result bronze-pos'
        } else {
          cardModifier = 'has-result'
        }

        const grade = result.grade || '-'
        const pts = (result.placement_points || 0) + (result.grade_points || 0)

        resultHtml = `
          <div class="comp-result-col">
            <div class="position-plaque ${posClass}">
              <span class="rank-emoji">${emoji}</span>
              <span class="rank-label">${label}</span>
            </div>
            <div class="result-points-block">
              <div class="grade-badge-row">
                <span class="grade-pill">Grade ${grade}</span>
                <span class="points-sum-text">${pts} PTS</span>
              </div>
              <div class="points-breakdown">
                Avg: ${result.avg_points || 0} | Plmt: ${result.placement_points || 0} | Grd: ${result.grade_points || 0}
              </div>
            </div>
          </div>
        `
      } else {
        resultHtml = `
          <div class="comp-result-col">
            <div class="pending-status-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              <span>Awaiting Result / In Progress</span>
            </div>
          </div>
        `
      }

      return `
        <div class="comp-event-card ${cardModifier} ${index === this.focusedCardIndex ? 'focused' : ''}" data-index="${index}">
          <div class="comp-info-col">
            <h3 class="comp-name-title">${this.escapeHtml(c.name || 'Competition')}</h3>
            <div class="comp-badges-row">
              <span class="stage-badge ${isStage ? 'stage' : 'offstage'}">${stageName}</span>
              ${schedDate ? `
                <span class="comp-schedule-badge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <span>${schedDate}</span>
                </span>
              ` : ''}
              ${schedDur ? `
                <span class="comp-schedule-badge">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>
                  <span>${schedDur}</span>
                </span>
              ` : ''}
            </div>
          </div>
          ${resultHtml}
        </div>
      `
    }).join('')

    this.updateCardFocus()
  }

  renderHistoryPills() {
    if (!this.dom.recentHistoryPills) return
    this.dom.recentHistoryPills.innerHTML = this.scanHistory.map(num => `
      <button class="history-chip" onclick="window.app.searchChestNumber('${num}')">#${num}</button>
    `).join('')
  }



  // --------------------------------------------------------------------------
  // KEYBOARD NAVIGATION & REMOTE CONTROL
  // --------------------------------------------------------------------------
  initKeyboardControls() {
    window.addEventListener('keydown', (e) => {
      const isSearchInputFocused = document.activeElement === this.dom.chestInput

      if (!isSearchInputFocused && /^[0-9]$/.test(e.key)) {
        this.dom.chestInput.focus()
        this.dom.chestInput.value = e.key
        e.preventDefault()
        return
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          this.navigateCards(1)
          break

        case 'ArrowUp':
          e.preventDefault()
          this.navigateCards(-1)
          break

        case 'ArrowRight':
          e.preventDefault()
          this.navigateHistory(1)
          break

        case 'ArrowLeft':
          e.preventDefault()
          this.navigateHistory(-1)
          break

        case 'Escape':
          if (this.isAnnouncementActive) {
            e.preventDefault()
            this.closeResultAnnouncement()
            break
          }
          if (this.isHelpModalOpen) {
            this.toggleHelpModal()
            break
          }
          if (!isSearchInputFocused) {
            e.preventDefault()
            if (this.currentView === 'result') {
              this.switchView('standby')
            } else {
              this.switchView('dashboard')
            }
          }
          break

        case 'Backspace':
          if (!isSearchInputFocused) {
            e.preventDefault()
            if (this.currentView === 'result') {
              this.switchView('standby')
            } else {
              this.switchView('dashboard')
            }
          }
          break

        case 't':
        case 'T':
          if (!isSearchInputFocused) {
            e.preventDefault()
            this.testResultAnnouncement()
          }
          break

        case 'p':
        case 'P':
          if (!isSearchInputFocused) {
            e.preventDefault()
            if (!this.activeMilestonePosterUrl) {
              this.showToast('ℹ️ No milestone poster configured in database')
              console.warn('⚠️ Key P pressed but no activeMilestonePosterUrl is found')
              return
            }
            const isShowingPoster = this.dom.dashboardPosterShowcase?.classList.contains('active')
            this.toggleDashboardPosterDisplay(!isShowingPoster)
          }
          break

        case 'r':
        case 'R':
          if (!isSearchInputFocused) {
            e.preventDefault()
            this.fetchDashboardPoints()
            this.showToast('Standings Refreshed!')
          }
          break

        case 'f':
        case 'F':
          if (!isSearchInputFocused) {
            e.preventDefault()
            this.toggleFullscreen()
          }
          break

        case 'r':
        case 'R':
          if (!isSearchInputFocused) {
            e.preventDefault()
            if (this.currentParticipant) {
              this.searchChestNumber(this.currentParticipant.chess_number)
            } else {
              this.fetchStandbyData()
            }
            this.showToast('Data refreshed!')
          }
          break

        case 'm':
        case 'M':
          if (!isSearchInputFocused) {
            e.preventDefault()
            this.toggleAudio()
          }
          break

        case 'v':
        case 'V':
          if (!isSearchInputFocused) {
            e.preventDefault()
            this.toggleCameraFlip()
          }
          break

        case 'z':
        case 'Z':
          if (!isSearchInputFocused) {
            e.preventDefault()
            this.cycleZoom()
          }
          break

        case '?':
        case 'h':
        case 'H':
          if (!isSearchInputFocused) {
            e.preventDefault()
            this.toggleHelpModal()
          }
          break
      }
    })
  }

  toggleCameraFlip() {
    const reader = document.getElementById('qrReader')
    if (!reader) return
    reader.classList.toggle('no-flip')
    const isMirrored = !reader.classList.contains('no-flip')
    localStorage.setItem('camera_flip_mirrored', isMirrored ? 'true' : 'false')
    this.showToast(isMirrored ? 'Camera Flip: Mirrored (Horizontal Flip ON)' : 'Camera Flip: Standard (No Flip)')
  }

  navigateCards(direction) {
    if (this.currentView !== 'result') return

    const cards = this.dom.competitionsListCards.querySelectorAll('.comp-event-card')
    if (cards.length === 0) return

    this.focusedCardIndex = Math.max(0, Math.min(cards.length - 1, this.focusedCardIndex + direction))
    this.updateCardFocus()
    this.playTick()
    this.resetCountdown()
  }

  updateCardFocus() {
    const cards = this.dom.competitionsListCards.querySelectorAll('.comp-event-card')
    cards.forEach((card, i) => {
      if (i === this.focusedCardIndex) {
        card.classList.add('focused')
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      } else {
        card.classList.remove('focused')
      }
    })
  }

  navigateHistory(direction) {
    if (this.scanHistory.length <= 1) return
    const currentNum = this.currentParticipant?.chess_number
    const currentIndex = this.scanHistory.indexOf(currentNum)
    let nextIndex = currentIndex + direction

    if (nextIndex < 0) nextIndex = this.scanHistory.length - 1
    if (nextIndex >= this.scanHistory.length) nextIndex = 0

    const nextChest = this.scanHistory[nextIndex]
    if (nextChest) {
      this.searchChestNumber(nextChest)
    }
  }

  // --------------------------------------------------------------------------
  // AUTO-STANDBY COUNTDOWN TIMER
  // --------------------------------------------------------------------------
  startCountdown() {
    this.stopCountdown()
    this.countdownRemaining = this.countdownMax
    this.isCountdownPaused = false
    this.updateCountdownDisplay()

    this.countdownInterval = setInterval(() => {
      if (this.isCountdownPaused) return

      this.countdownRemaining--
      this.updateCountdownDisplay()

      if (this.countdownRemaining <= 0) {
        this.stopCountdown()
        this.switchView('dashboard')
        this.showToast('Returned to Live Points Leaderboard')
      }
    }, 1000)
  }

  stopCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval)
      this.countdownInterval = null
    }
  }

  resetCountdown() {
    if (this.currentView === 'result') {
      this.countdownRemaining = this.countdownMax
      this.updateCountdownDisplay()
    }
  }

  togglePauseCountdown() {
    this.isCountdownPaused = !this.isCountdownPaused
    if (this.dom.btnPauseCountdown) {
      this.dom.btnPauseCountdown.textContent = this.isCountdownPaused ? 'RESUME' : 'PAUSE'
    }
    this.showToast(this.isCountdownPaused ? 'Auto-return paused' : 'Auto-return resumed')
  }

  updateCountdownDisplay() {
    if (this.dom.countdownText) {
      this.dom.countdownText.textContent = `Auto-return in ${this.countdownRemaining}s`
    }
    if (this.dom.countdownBar) {
      const percentage = (this.countdownRemaining / this.countdownMax) * 100
      this.dom.countdownBar.style.width = `${percentage}%`
    }
  }

  // --------------------------------------------------------------------------
  // UI INTERACTIONS & EVENT LISTENERS
  // --------------------------------------------------------------------------
  initEventListeners() {
    this.dom.btnBackStandby?.addEventListener('click', () => {
      this.switchView('standby')
    })

    this.dom.chestInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        this.handleManualSearch()
      }
    })

    this.dom.btnFullscreen?.addEventListener('click', () => this.toggleFullscreen())
    this.dom.btnPauseCam?.addEventListener('click', () => this.toggleCameraPause())
    document.getElementById('btnToggleNavView')?.addEventListener('click', () => {
      if (this.currentView === 'dashboard') {
        this.switchView('standby')
      } else {
        this.switchView('dashboard')
      }
    })

    document.getElementById('btnFlipCam')?.addEventListener('click', () => this.toggleCameraFlip())
    document.getElementById('btnZoom1')?.addEventListener('click', () => this.setZoom(1))
    document.getElementById('btnZoom15')?.addEventListener('click', () => this.setZoom(1.5))
    document.getElementById('btnZoom2')?.addEventListener('click', () => this.setZoom(2))
    this.dom.btnMute?.addEventListener('click', () => this.toggleAudio())
    this.dom.btnHelp?.addEventListener('click', () => this.toggleHelpModal())
    this.dom.btnCloseHelp?.addEventListener('click', () => this.toggleHelpModal())
    this.dom.btnPauseCountdown?.addEventListener('click', () => this.togglePauseCountdown())

    // Result Announcement Close Listeners
    this.dom.btnCloseAnnouncement?.addEventListener('click', () => this.closeResultAnnouncement())
    this.dom.resultAnnouncementOverlay?.addEventListener('click', (e) => {
      if (e.target === this.dom.resultAnnouncementOverlay) {
        this.closeResultAnnouncement()
      }
    })

    const savedFlip = localStorage.getItem('camera_flip_mirrored')
    if (savedFlip === 'false') {
      document.getElementById('qrReader')?.classList.add('no-flip')
    }

    this.dom.helpModal?.addEventListener('click', (e) => {
      if (e.target === this.dom.helpModal) this.toggleHelpModal()
    })

    const tabs = [this.dom.tabFilterAll, this.dom.tabFilterResults, this.dom.tabFilterScheduled]
    tabs.forEach(tab => {
      tab?.addEventListener('click', () => {
        tabs.forEach(t => t?.classList.remove('active'))
        tab.classList.add('active')
        this.currentFilter = tab.dataset.filter
        
        const resultsMap = {}
        this.currentResults.forEach(r => { resultsMap[r.competition_id] = r })
        this.focusedCardIndex = 0
        this.renderCompetitionsList(resultsMap)
        this.resetCountdown()
      })
    })

    window.addEventListener('mousemove', () => this.resetCountdown())
    window.addEventListener('click', () => this.resetCountdown())
  }

  handleManualSearch() {
    const query = this.dom.chestInput.value.trim()
    if (query) {
      this.dom.chestInput.blur()
      this.searchChestNumber(query)
      this.dom.chestInput.value = ''
    }
  }

  switchView(viewName = 'dashboard', shouldFetch = true) {
    this.currentView = 'dashboard'
    if (this.dom.viewDashboard) {
      this.dom.viewDashboard.classList.add('active')
    }
    if (shouldFetch) {
      this.fetchDashboardPoints()
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn('Fullscreen error:', err)
      })
      this.showToast('Fullscreen Mode Enabled')
    } else {
      document.exitFullscreen().catch(() => {})
      this.showToast('Fullscreen Mode Exited')
    }
  }

  toggleHelpModal() {
    if (!this.dom.helpModal) return
    this.dom.helpModal.classList.toggle('active')
  }

  // --------------------------------------------------------------------------
  // AUDIO SYNTHESIZER
  // --------------------------------------------------------------------------
  initAudio() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (AudioContext) {
        this.audioCtx = new AudioContext()
      }
    } catch (e) {}
  }

  playChime() {
    if (!this.audioEnabled) return
    try {
      if (!this.audioCtx) this.initAudio()
      if (!this.audioCtx) return

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume()
      }

      const now = this.audioCtx.currentTime
      const osc1 = this.audioCtx.createOscillator()
      const osc2 = this.audioCtx.createOscillator()
      const gain = this.audioCtx.createGain()

      osc1.type = 'sine'
      osc2.type = 'triangle'

      osc1.frequency.setValueAtTime(523.25, now)
      osc1.frequency.exponentialRampToValueAtTime(783.99, now + 0.15)

      osc2.frequency.setValueAtTime(659.25, now)
      osc2.frequency.exponentialRampToValueAtTime(1046.50, now + 0.18)

      gain.gain.setValueAtTime(0.18, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45)

      osc1.connect(gain)
      osc2.connect(gain)
      gain.connect(this.audioCtx.destination)

      osc1.start(now)
      osc2.start(now)
      osc1.stop(now + 0.45)
      osc2.stop(now + 0.45)
    } catch (e) {}
  }

  playTick() {
    if (!this.audioEnabled) return
    try {
      if (!this.audioCtx || this.audioCtx.state === 'suspended') return
      const now = this.audioCtx.currentTime
      const osc = this.audioCtx.createOscillator()
      const gain = this.audioCtx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(800, now)
      gain.gain.setValueAtTime(0.04, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
      osc.connect(gain)
      gain.connect(this.audioCtx.destination)
      osc.start(now)
      osc.stop(now + 0.05)
    } catch (e) {}
  }

  toggleAudio() {
    this.audioEnabled = !this.audioEnabled
    this.showToast(this.audioEnabled ? 'Audio Chimes Enabled' : 'Audio Muted')
  }

  // --------------------------------------------------------------------------
  // ZERO-TOUCH AUTO UPDATE & TV RELOAD ENGINE
  // --------------------------------------------------------------------------
  initAutoUpdateChecker() {
    let currentBuildTimestamp = null

    const checkVersion = async () => {
      try {
        const res = await fetch(`version.json?_t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()

        if (currentBuildTimestamp === null) {
          currentBuildTimestamp = data.timestamp
          return
        }

        // If deploy timestamp changed, auto-reload TV screen gracefully
        if (data.timestamp && data.timestamp !== currentBuildTimestamp) {
          console.log('🚀 New Netlify build detected! Timestamp:', data.timestamp)
          currentBuildTimestamp = data.timestamp

          // If a competition result announcement is currently active on screen, wait until it finishes completely!
          const performGracefulReload = () => {
            if (this.isAnnouncementActive || (this.announcementQueue && this.announcementQueue.length > 0)) {
              console.log('⏳ Competition result currently on TV -> Postponing reload until announcement completes...')
              setTimeout(performGracefulReload, 3000)
              return
            }
            this.showToast('🚀 New update deployed! Updating TV display...')
            setTimeout(() => {
              window.location.reload(true)
            }, 2000)
          }

          performGracefulReload()
        }
      } catch (e) {
        // Network silent
      }
    }

    // Initial check
    checkVersion()
    // Poll every 15 seconds
    setInterval(checkVersion, 15000)
  }

  // --------------------------------------------------------------------------
  // LIVE HEADER CLOCK & UTILITIES
  // --------------------------------------------------------------------------
  initClock() {
    const update = () => {
      if (!this.dom.liveClock) return
      const now = new Date()
      const timeStr = now.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' })
      const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase()
      this.dom.liveClock.textContent = `${timeStr} - ${dateStr}`
    }
    update()
    setInterval(update, 1000)
  }

  // --------------------------------------------------------------------------
  // TOPBAR TOGGLE & AUTO-HIDE CONTROLLER
  // --------------------------------------------------------------------------
  initHeaderToggle() {
    const header = document.getElementById('tvHeader') || document.querySelector('.tv-header')
    const toggleBtn = document.getElementById('btnToggleTopHeader')
    if (!header || !toggleBtn) return

    let hideTimer = null

    const showHeader = () => {
      header.classList.add('header-revealed')
      toggleBtn.classList.add('active')
      resetTimer()
    }

    const hideHeader = () => {
      header.classList.remove('header-revealed')
      toggleBtn.classList.remove('active')
      if (hideTimer) {
        clearTimeout(hideTimer)
        hideTimer = null
      }
    }

    const resetTimer = () => {
      if (hideTimer) clearTimeout(hideTimer)
      hideTimer = setTimeout(() => {
        if (document.activeElement === this.dom?.chestInput) return
        hideHeader()
      }, 6000)
    }

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      if (header.classList.contains('header-revealed')) {
        hideHeader()
      } else {
        showHeader()
      }
    })

    header.addEventListener('mouseleave', () => {
      if (document.activeElement === this.dom?.chestInput) return
      resetTimer()
    })

    header.addEventListener('mousemove', resetTimer)
    header.addEventListener('keydown', resetTimer)
  }

  showLoading(subtext = 'Connecting to festival database...') {
    if (this.dom.loadingSubtitle) this.dom.loadingSubtitle.textContent = subtext
    this.dom.loadingOverlay?.classList.add('active')
  }

  hideLoading() {
    this.dom.loadingOverlay?.classList.remove('active')
  }

  showToast(msg) {
    if (!this.dom.tvToast || !this.dom.toastMessage) return
    this.dom.toastMessage.textContent = msg
    this.dom.tvToast.classList.add('active')
    setTimeout(() => {
      this.dom.tvToast.classList.remove('active')
    }, 2800)
  }

  escapeHtml(str) {
    if (!str) return ''
    return str.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }
}

// Instantiate TV App on page load
window.addEventListener('DOMContentLoaded', () => {
  window.app = new TvApp()
})
