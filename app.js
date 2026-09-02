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
      countScheduledEvents: document.getElementById('countScheduledEvents')
    }

    this.init()
  }

  async init() {
    this.initClock()
    this.initAutoUpdateChecker()
    this.initSupabase()
    this.initAudio()
    this.initKeyboardControls()
    this.initEventListeners()
    
    // 1. Fetch & Render Main TV Dashboard Points (Default View)
    await this.fetchDashboardPoints()
    this.startDashboardSync()

    // 2. Load standby stats in background
    this.fetchStandbyData()

    // 3. Check if initial hash is present in URL (e.g. #108)
    const hash = window.location.hash.replace('#', '').trim()
    if (hash) {
      this.searchChestNumber(hash)
    } else {
      this.switchView('dashboard')
    }
  }

  // --------------------------------------------------------------------------
  // SUPABASE INITIALIZATION & QUERIES
  // --------------------------------------------------------------------------
  initSupabase() {
    try {
      if (window.supabase && typeof window.supabase.createClient === 'function') {
        this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      } else {
        console.warn('Local Supabase not found, loading from CDN...')
        const script = document.createElement('script')
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
        script.onload = () => {
          this.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
          this.fetchDashboardPoints()
          this.fetchStandbyData()
        }
        document.head.appendChild(script)
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

    try {
      // 1. Fetch App Settings, Teams, and Published Competition Results in Parallel (matching V1)
      const [settingsRes, teamsRes, resultsRes, partsCountRes, compsCountRes] = await Promise.all([
        this.supabase.from('app_settings').select('key, value').in('key', ['leaderboard_revealed_milestone', 'announcer_sequence', 'team_colors']),
        this.supabase.from('teams').select('id, name').order('name'),
        this.supabase.from('competition_results')
          .select('position, placement_points, grade_points, competition_id, participants(team_id)')
          .eq('published', true),
        this.supabase.from('participants').select('id', { count: 'exact', head: true }),
        this.supabase.from('competitions').select('id', { count: 'exact', head: true })
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
          goldCount: 0,
          silverCount: 0,
          bronzeCount: 0,
          totalWins: 0
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

          if (r.position === 1) teamMap[tid].goldCount++
          else if (r.position === 2) teamMap[tid].silverCount++
          else if (r.position === 3) teamMap[tid].bronzeCount++

          if (r.position && r.position <= 3) teamMap[tid].totalWins++
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

      this.dashboardPointsData = sortedTeams
      this.revealedMilestone = revealedMilestone

      // Update Header with exact Milestone text (e.g. STATUS AFTER 40 RESULTS)
      const headingEl = document.querySelector('.broadcast-main-heading')
      if (headingEl) {
        headingEl.textContent = revealedMilestone > 0 
          ? `STATUS AFTER ${revealedMilestone} RESULTS` 
          : `CHAMPIONSHIP LEADERBOARD`
      }

      const liveBadgeSpan = document.querySelector('.broadcast-live-badge span:last-child')
      if (liveBadgeSpan) {
        liveBadgeSpan.textContent = revealedMilestone > 0 
          ? `POINTS STATUS • AFTER ${revealedMilestone} RESULTS` 
          : `LIVE POINTS STANDING`
      }

      // Render the 3 Team Podium Cards
      this.renderDashboardPodium(sortedTeams)

      // Update Bottom Stats Tiles
      if (this.dom.dbTotalPoints) {
        this.animateNumber(this.dom.dbTotalPoints, overallTotalPoints)
      }
      if (this.dom.dbPublishedEvents) {
        this.dom.dbPublishedEvents.textContent = revealedMilestone > 0 
          ? `${revealedMilestone} Results (Status Point)` 
          : `${publishedCompIds.size} / ${compsCountRes.count || '--'}`
      }
      if (this.dom.dbTotalParticipants && partsCountRes.count !== null) {
        this.dom.dbTotalParticipants.textContent = partsCountRes.count
      }

      // Fetch Latest Published Winner
      this.fetchLatestWinnerAnnouncement()

      // Update sync time
      const syncEl = document.getElementById('dbSyncTimeText')
      if (syncEl) {
        const now = new Date()
        syncEl.textContent = `Live: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
      }

    } catch (err) {
      console.error('Error fetching dashboard points:', err)
    }
  }

  renderDashboardPodium(teams) {
    if (!this.dom.dashboardPodiumGrid) return
    if (teams.length === 0) {
      this.dom.dashboardPodiumGrid.innerHTML = `
        <div class="dashboard-loading-state">
          <span>Awaiting official championship results...</span>
        </div>
      `
      return
    }

    const maxPoints = Math.max(...teams.map(t => t.totalPoints), 1)

    // STRICT ORDER: Highest points FIRST (#1 on left, #2 center, #3 right)
    const displayOrder = teams

    this.dom.dashboardPodiumGrid.innerHTML = displayOrder.map((team, index) => {
      const rank = index + 1
      const isLeader = rank === 1
      const percent = Math.min(100, Math.round((team.totalPoints / maxPoints) * 100))

      return `
        <div class="podium-team-card ${isLeader ? 'rank-1-leader' : ''}" style="--team-color: ${team.color}; border: 2px solid ${team.color};">
          <div class="team-accent-glow-top" style="background: ${team.color};"></div>
          
          <div class="podium-card-header">
            <div class="team-rank-tag rank-${rank}">
              <span class="rank-num-val">#0${rank}</span>
              ${isLeader ? `<span class="crown-icon-glow">👑</span>` : ''}
            </div>
            ${isLeader ? `<div class="leader-badge-pill">CHAMPIONSHIP LEADER</div>` : ''}
          </div>

          <div class="team-identity-block">
            <h2 class="team-display-name">${this.escapeHtml(team.name)}</h2>
          </div>

          <div class="team-score-block">
            <div class="score-points-number" id="pts-count-${team.id}" style="color: #fff; text-shadow: 0 0 45px ${team.color}, 0 0 90px ${team.color}88;">
              ${team.totalPoints}
            </div>
            <div class="score-unit-text">POINTS</div>

            <div class="team-progress-bar-wrap">
              <div class="team-progress-bar-fill" style="width: ${percent}%; background: linear-gradient(90deg, ${team.color}, #ffffff); box-shadow: 0 0 25px ${team.color};"></div>
            </div>
          </div>

          <div class="team-breakdown-row">
            <span class="breakdown-item">Placement: <strong>${team.placementPoints}</strong></span>
            <span class="breakdown-divider">|</span>
            <span class="breakdown-item">Grade: <strong>${team.gradePoints}</strong></span>
          </div>

          <div class="team-medals-tally">
            <div class="medal-count-box" title="1st Place (Gold)">
              <span class="medal-icon-badge">🥇</span>
              <span>${team.goldCount}</span>
            </div>
            <div class="medal-count-box" title="2nd Place (Silver)">
              <span class="medal-icon-badge">🥈</span>
              <span>${team.silverCount}</span>
            </div>
            <div class="medal-count-box" title="3rd Place (Bronze)">
              <span class="medal-icon-badge">🥉</span>
              <span>${team.bronzeCount}</span>
            </div>
          </div>
        </div>
      `
    }).join('')

    // Animate point numbers
    teams.forEach(t => {
      const el = document.getElementById(`pts-count-${t.id}`)
      if (el) this.animateNumber(el, t.totalPoints)
    })
  }

  animateNumber(element, target) {
    if (!element) return
    const start = 0
    const duration = 1100
    const startTime = performance.now()

    const step = (currentTime) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      const currentVal = Math.floor(start + (target - start) * ease)
      element.textContent = currentVal.toLocaleString()

      if (progress < 1) {
        requestAnimationFrame(step)
      } else {
        element.textContent = target.toLocaleString()
      }
    }
    requestAnimationFrame(step)
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

  startDashboardSync() {
    if (this.dashboardSyncInterval) {
      clearInterval(this.dashboardSyncInterval)
    }
    // Auto sync every 20 seconds
    this.dashboardSyncInterval = setInterval(() => {
      if (this.currentView === 'dashboard') {
        this.fetchDashboardPoints()
      }
    }, 20000)
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
  // WEBCAM & QR SCANNER ENGINE
  // --------------------------------------------------------------------------
  initCameraScanner() {
    if (typeof Html5QrcodeScanner === 'undefined') {
      setTimeout(() => this.initCameraScanner(), 300)
      return
    }

    try {
      if (this.scannerInstance) {
        try { this.scannerInstance.clear() } catch (e) {}
      }

      this.currentZoom = 1

      // Matching Art Gallery V1 LandingPage.jsx with safe, responsive qrbox
      this.scannerInstance = new Html5QrcodeScanner(
        'qrReader',
        {
          fps: 15,
          qrbox: { width: 280, height: 280 },
          rememberLastUsedCamera: true,
          supportedScanTypes: [0],
          showTorchButtonIfSupported: true,
          videoConstraints: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        },
        false
      )

      this.scannerInstance.render(
        (decodedText) => this.handleQrCodeScanned(decodedText),
        (error) => {
          // ignore frame seeking errors
        }
      )

      this.isCameraRunning = true
      this.updateCameraStatus(true, 'WEBCAM ACTIVE / SCANNING')

      // Start Multi-Scale background scanner for low-clarity webcams
      this.startSuperResolutionScanner()

    } catch (err) {
      console.error('Html5QrcodeScanner init error:', err)
      this.updateCameraStatus(false, 'CLICK SCANNER TO START')
    }
  }

  // --------------------------------------------------------------------------
  // MULTI-SCALE DUAL SCANNER (LOW-QUALITY WEBCAM OPTIMIZATION)
  // --------------------------------------------------------------------------
  startSuperResolutionScanner() {
    this.stopSuperResolutionScanner()

    if (!('BarcodeDetector' in window)) return

    try {
      const barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] })
      const canvas = document.createElement('canvas')
      canvas.width = 480
      canvas.height = 480
      const ctx = canvas.getContext('2d', { willReadFrequently: true })

      let isProcessing = false
      let pass = 0

      // Alternates: Pass 0 (Full video frame) -> Pass 1 (Center 1.8x Zoom for small/distant codes)
      this.superScanInterval = setInterval(async () => {
        if (isProcessing) return
        const video = document.querySelector('#qrReader video')
        if (!video || video.readyState < 2 || video.paused || !video.videoWidth) return

        isProcessing = true
        try {
          const vw = video.videoWidth
          const vh = video.videoHeight

          if (pass === 0) {
            pass = 1
            // Full video frame pass
            const barcodes = await barcodeDetector.detect(video)
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              this.handleQrCodeScanned(barcodes[0].rawValue)
              isProcessing = false
              return
            }
          } else {
            pass = 0
            // Center 1.8x Zoom pass (magnifies small QR codes from low quality cameras)
            const cropW = vw * 0.55
            const cropH = vh * 0.55
            const cropX = (vw - cropW) / 2
            const cropY = (vh - cropH) / 2

            ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height)
            const barcodes = await barcodeDetector.detect(canvas)
            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
              this.handleQrCodeScanned(barcodes[0].rawValue)
            }
          }
        } catch (e) {
          // ignore dropped frames
        } finally {
          isProcessing = false
        }
      }, 100) // 10 FPS smooth scan without lag
    } catch (e) {
      console.warn('Super-resolution scanner setup error:', e)
    }
  }

  stopSuperResolutionScanner() {
    if (this.superScanInterval) {
      clearInterval(this.superScanInterval)
      this.superScanInterval = null
    }
  }

  setZoom(level) {
    this.currentZoom = level
    const qrReader = document.getElementById('qrReader')
    if (qrReader) {
      qrReader.classList.remove('zoom-15x', 'zoom-20x')
      if (level === 1.5) qrReader.classList.add('zoom-15x')
      if (level === 2) qrReader.classList.add('zoom-20x')
    }

    try {
      const video = document.querySelector('#qrReader video')
      const track = video?.srcObject?.getVideoTracks()[0]
      if (track) {
        const caps = track.getCapabilities ? track.getCapabilities() : {}
        if (caps.zoom) {
          const target = Math.min(caps.zoom.max, Math.max(caps.zoom.min, level))
          track.applyConstraints({ advanced: [{ zoom: target }] }).catch(() => {})
        }
      }
    } catch (e) {}

    const zoomBtns = [document.getElementById('btnZoom1'), document.getElementById('btnZoom15'), document.getElementById('btnZoom2')]
    zoomBtns.forEach(btn => {
      if (!btn) return
      const isMatch = parseFloat(btn.dataset.zoom) === level
      btn.style.background = isMatch ? 'var(--accent)' : 'none'
      btn.style.color = isMatch ? '#fff' : 'rgba(255,255,255,0.6)'
    })

    this.showToast(`Camera Zoom: ${level}x`)
  }

  cycleZoom() {
    const next = this.currentZoom === 1 ? 1.5 : (this.currentZoom === 1.5 ? 2 : 1)
    this.setZoom(next)
  }

  toggleCameraPause() {
    const btn = document.querySelector('#qrReader button')
    if (btn) {
      btn.click()
    }
  }

  handleQrCodeScanned(qrText) {
    if (!qrText) return

    // Debounce to prevent multiple scans within 2.5s for same code
    const now = Date.now()
    if (this.lastScannedText === qrText && now - (this.lastScannedTime || 0) < 2500) {
      return
    }
    this.lastScannedText = qrText
    this.lastScannedTime = now

    const hashMatch = qrText.match(/#([a-zA-Z0-9_-]+)/)
    let chestNumber = hashMatch ? hashMatch[1] : qrText.trim()

    if (chestNumber.includes('http')) {
      try {
        const url = new URL(chestNumber)
        if (url.searchParams.get('chest')) {
          chestNumber = url.searchParams.get('chest')
        }
      } catch (e) {}
    }

    this.triggerScanFlash(`CHEST #${chestNumber} SCANNED!`)
    this.playChime()
    this.searchChestNumber(chestNumber)
  }

  triggerScanFlash(text) {
    if (!this.dom.scannerFeedbackFlash) return
    if (this.dom.feedbackText) this.dom.feedbackText.textContent = text
    this.dom.scannerFeedbackFlash.classList.add('active')
    setTimeout(() => {
      this.dom.scannerFeedbackFlash.classList.remove('active')
    }, 900)
  }

  updateCameraStatus(active, text) {
    if (this.dom.cameraStatusText) this.dom.cameraStatusText.textContent = text
    if (this.dom.cameraStatusPill) {
      if (active) {
        this.dom.cameraStatusPill.style.borderColor = 'rgba(184, 25, 60, 0.4)'
        this.dom.cameraStatusPill.style.color = '#fff'
      } else {
        this.dom.cameraStatusPill.style.borderColor = 'rgba(239, 68, 68, 0.4)'
        this.dom.cameraStatusPill.style.color = '#ef4444'
      }
    }
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

        case 'd':
        case 'D':
        case 'l':
        case 'L':
          if (!isSearchInputFocused) {
            e.preventDefault()
            if (this.currentView === 'dashboard') {
              this.switchView('standby')
            } else {
              this.switchView('dashboard')
            }
          }
          break

        case ' ': // Spacebar
          if (!isSearchInputFocused) {
            e.preventDefault()
            this.toggleCameraPause()
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

  switchView(viewName) {
    this.currentView = viewName

    const isDb = viewName === 'dashboard'
    const isStandby = viewName === 'standby'
    const isResult = viewName === 'result'

    this.dom.viewDashboard?.classList.toggle('active', isDb)
    this.dom.viewStandby?.classList.toggle('active', isStandby)
    this.dom.viewResult?.classList.toggle('active', isResult)

    if (isDb) {
      this.stopCountdown()
      this.stopSuperResolutionScanner()
      window.location.hash = ''
      if (this.dom.navViewLabel) this.dom.navViewLabel.textContent = 'QR SCANNER'
      if (this.dom.btnToggleNavView) {
        this.dom.btnToggleNavView.style.background = 'rgba(184, 25, 60, 0.25)'
        this.dom.btnToggleNavView.style.borderColor = 'var(--accent)'
      }
      this.fetchDashboardPoints()
    } else if (isStandby) {
      this.stopCountdown()
      window.location.hash = ''
      if (this.dom.navViewLabel) this.dom.navViewLabel.textContent = 'LEADERBOARD'
      if (this.dom.btnToggleNavView) {
        this.dom.btnToggleNavView.style.background = 'rgba(255, 255, 255, 0.08)'
        this.dom.btnToggleNavView.style.borderColor = 'rgba(255, 255, 255, 0.2)'
      }
      // Start camera scanner only when opening scanner view
      if (!this.isCameraRunning) {
        this.initCameraScanner()
      }
    } else if (isResult) {
      if (this.dom.navViewLabel) this.dom.navViewLabel.textContent = 'LEADERBOARD'
      if (this.currentParticipant) {
        window.location.hash = this.currentParticipant.chess_number
      }
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
        const res = await fetch(`/version.json?_t=${Date.now()}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()

        if (currentBuildTimestamp === null) {
          currentBuildTimestamp = data.timestamp
          return
        }

        // If deploy timestamp changed, auto-reload TV screen
        if (data.timestamp && data.timestamp !== currentBuildTimestamp) {
          console.log('🚀 New Netlify build detected! Timestamp:', data.timestamp)
          this.showToast('🚀 New update deployed! Refreshing TV in 3s...')
          currentBuildTimestamp = data.timestamp
          setTimeout(() => {
            window.location.reload(true)
          }, 3000)
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
