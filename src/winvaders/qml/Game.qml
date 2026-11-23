import QtQuick
import "logic.mjs" as Logic
import "sprites.mjs" as Sprites

FocusScope {
    id: root
    objectName: "game"
    width: 1280
    height: 720

    property var theme
    property bool soundOn: true
    property bool musicOn: true

    signal quitToMenu()
    signal toggleSound()
    signal finished(int score, int level)

    readonly property int playerY: 660
    readonly property int playerW: 56
    readonly property int playerH: 24
    readonly property int alienW: 40
    readonly property int alienH: 30
    readonly property int bossW: 220
    readonly property int bossH: 130
    readonly property int edge: 20
    readonly property int dangerY: 640
    readonly property int bunkerTop: 560

    property int score: 0
    property int level: 1
    property int lives: 3
    property int nextLife: Logic.EXTRA_LIFE_EVERY
    property int seed: 1

    property bool paused: false
    property bool gameOver: false
    property bool transitioning: false
    property bool finishedSent: false
    property int bannerTicks: 0
    property string bannerText: ""
    property string bannerSub: ""
    property int gameOverTicks: 0
    property int pauseIndex: 0

    property bool moveLeft: false
    property bool moveRight: false
    property bool fireHeld: false
    property real playerX: 640 - playerW / 2
    property int cooldown: 0
    property int invuln: 0
    property bool shield: false
    property string powerup: ""
    property int powerupTicks: 0
    property int frozen: 0
    property int doubleTicks: 0

    property var aliens: []
    property var boss: null
    property var bullets: []
    property var enemyBullets: []
    property var bunkers: []
    property var drops: []
    property var particles: []
    property var minions: []
    property var walls: []
    property var beams: []
    property int muted: 0
    property var shotLog: []
    property int marchDir: 1
    property int totalAliens: 1
    property var diff: Logic.difficulty(1)
    property int tickCount: 0

    property var rain: []
    readonly property var rainGlyphs: "01$#&@%+=-_<>/~^".split("")

    readonly property int hiScore: {
        const s = Storage.scores()
        return s.length ? Math.max(s[0].score, score) : score
    }

    function menace() {
        return Math.min(5, Math.floor((level - 1) / 2))
    }

    function play(name) {
        Sound.play(name)
    }

    function resetRain() {
        const cols = Math.floor(1280 / 16)
        const arr = []
        for (let i = 0; i < cols; i++) arr.push(Math.random() * -40)
        rain = arr
    }

    function startNew() {
        score = 0
        level = 1
        lives = 3
        nextLife = Logic.EXTRA_LIFE_EVERY
        seed = Date.now() % 2147483647
        beginLevel()
    }

    function resume(save) {
        score = save.score
        level = save.level
        lives = save.lives
        nextLife = save.next_life
        seed = save.seed
        beginLevel()
    }

    function beginLevel() {
        gameOver = false
        finishedSent = false
        paused = false
        Storage.writeSave({ level: level, score: score, lives: lives, next_life: nextLife, seed: seed })
        const fresh = spawnWave()
        playerX = 640 - playerW / 2
        bullets = []
        enemyBullets = []
        drops = []
        frozen = 0
        minions = []
        walls = []
        beams = []
        muted = 0
        shotLog = []
        invuln = 0
        transitioning = true
        bannerTicks = 70
        if (boss && boss.guest) {
            bannerText = Logic.BOSS_SHORT[boss.type] + " x " + Logic.BOSS_SHORT[boss.guest]
            bannerSub = "FUSION"
        } else if (boss) {
            bannerText = "BOSS: " + Logic.BOSS_NAMES[boss.type].toUpperCase()
            bannerSub = "Level " + level
        } else {
            bannerText = "LEVEL " + level
            bannerSub = fresh.length ? "NEW: " + fresh.map(t => Logic.ROSTER[t].name).join(", ") : ""
        }
        if (boss) play("boss")
        Music.play(boss ? (boss.guest ? boss.type + "+" + boss.guest : boss.type) : "level")
    }

    function spawnWave() {
        const wave = Logic.generateWave(level, seed)
        diff = Logic.difficulty(level)
        const cols = diff.cols
        const width = (cols - 1) * 64 + alienW
        const x0 = (1280 - width) / 2
        const y0 = wave.boss ? 240 : diff.startY
        aliens = wave.aliens.map(a => ({
            type: a.type, hp: a.hp, maxHp: a.maxHp, points: a.points, col: a.col,
            x: x0 + a.col * 64, y: y0 + a.row * 50, w: alienW, h: alienH, alive: true
        }))
        totalAliens = aliens.length
        marchDir = 1
        boss = wave.boss ? Object.assign({ x: 640 - bossW / 2, y: 60, w: bossW, h: bossH, dir: 1,
                                           timer: wave.boss.attackEvery, attackIndex: 0, flash: 0 }, wave.boss)
                         : null
        buildBunkers()
        return wave.newTypes
    }

    function buildBunkers() {
        const cells = []
        for (let b = 0; b < 4; b++) {
            const bx = Math.round(1280 * (b + 1) / 5 - 36)
            for (let r = 0; r < 4; r++)
                for (let c = 0; c < 6; c++) {
                    if (r === 3 && (c === 2 || c === 3)) continue
                    cells.push({ x: bx + c * 12, y: bunkerTop + r * 12, w: 12, h: 12, hp: 3 })
                }
        }
        bunkers = cells
    }

    function addScore(points) {
        score += doubleTicks > 0 ? points * 2 : points
        const r = Logic.awardLives(score, nextLife)
        if (r.gained > 0) {
            lives += r.gained
            play("extralife")
        }
        nextLife = r.nextLife
    }

    function burst(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2
            const s = 1 + Math.random() * 4
            particles.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 30 + Math.random() * 20,
                             color: color || theme.rainbow[i % theme.rainbow.length] })
        }
    }

    function damageAlien(a, amount) {
        a.hp -= amount
        if (a.hp > 0) {
            play("hit")
            return
        }
        a.alive = false
        addScore(a.points)
        burst(a.x + a.w / 2, a.y + a.h / 2, null, 12)
        play("kill")
        if (Math.random() < Logic.POWERUP_DROP)
            drops.push({ type: Logic.pickPowerup(Math.random()), x: a.x, y: a.y, w: 38, h: 24 })
    }

    function damageBoss(amount) {
        if (!boss || boss.hp <= 0) return
        boss.hp -= amount
        boss.flash = 4
        if (boss.hp > 0) {
            play("bosshit")
            return
        }
        addScore(boss.points)
        for (let i = 0; i < 6; i++)
            burst(boss.x + Math.random() * boss.w, boss.y + Math.random() * boss.h, null, 20)
        play("bossdeath")
        shield = true
        minions = []
        beams = []
    }

    function explode(x, y) {
        const r = Logic.BOMB_RADIUS
        burst(x, y, "#ff8c00", 24)
        play("kill")
        const near = o => Math.hypot(o.x + o.w / 2 - x, o.y + o.h / 2 - y) < r + o.w / 2
        for (const a of aliens) if (a.alive && near(a)) damageAlien(a, 1)
        for (const m of minions) {
            if (m.hp > 0 && near(m)) {
                m.hp = 0
                addScore(10)
            }
        }
        if (boss && boss.hp > 0 && Logic.rectsOverlap({ x: x - r, y: y - r, w: r * 2, h: r * 2 }, boss)) damageBoss(1)
    }

    function nuke() {
        enemyBullets = []
        for (const a of aliens) if (a.alive) damageAlien(a, 1)
        for (const m of minions) m.hp = 0
        for (const w of walls) w.hp = 0
        beams = []
        if (boss && boss.hp > 0) damageBoss(3)
        for (let i = 0; i < 8; i++) burst(Math.random() * 1280, 100 + Math.random() * 450, null, 16)
        play("bossdeath")
    }

    function collect(type) {
        play("powerup")
        if (type === "firewall") shield = true
        else if (type === "oneup") { lives += 1; play("extralife") }
        else if (type === "freeze") frozen = Logic.FREEZE_TICKS
        else if (type === "double") doubleTicks = Logic.POWERUP_TICKS
        else if (type === "nuke") nuke()
        else { powerup = type; powerupTicks = Logic.POWERUP_TICKS }
    }

    function applyMute() {
        if (muted === 0) play("hit")
        muted = Logic.MUTE_TICKS
    }

    function dropBossTo(y) {
        if (boss) boss.y = y
    }

    function killAll() {
        for (const a of aliens) if (a.alive) damageAlien(a, a.hp)
        if (boss) damageBoss(boss.hp)
    }

    function fire() {
        if (paused || gameOver || transitioning || cooldown > 0 || muted > 0) return
        const rapid = powerup === "pacman"
        const spread = powerup === "sudo"
        const max = (rapid ? 6 : 3) * (spread ? 3 : 1)
        if (bullets.length >= max) return
        const bx = playerX + playerW / 2 - 2
        const kind = powerup === "bomb" || powerup === "laser" || powerup === "homing" ? powerup : ""
        const h = kind === "laser" ? 26 : 14
        if (spread) {
            for (const vx of [-2.5, 0, 2.5]) bullets.push({ x: bx, y: playerY - 12, w: 4, h: h, vx: vx, kind: kind })
        } else {
            bullets.push({ x: bx, y: playerY - 12, w: 4, h: h, vx: 0, kind: kind, hits: [] })
        }
        shotLog.push(bx)
        if (shotLog.length > 8) shotLog.shift()
        cooldown = rapid ? 6 : 12
        play("shoot")
    }

    function hitPlayer() {
        if (invuln > 0 || gameOver) return
        if (shield) {
            shield = false
            invuln = 30
            play("hit")
            return
        }
        lives -= 1
        burst(playerX + playerW / 2, playerY + playerH / 2, theme.green, 30)
        play("playerhit")
        enemyBullets = []
        invuln = 90
        if (lives <= 0) endGame()
    }

    function endGame() {
        lives = 0
        gameOver = true
        gameOverTicks = 120
        moveLeft = false
        moveRight = false
        fireHeld = false
        Storage.clearSave()
        Music.stop()
        play("gameover")
    }

    function pause() {
        if (gameOver) return
        paused = true
        pauseIndex = 0
        moveLeft = false
        moveRight = false
        fireHeld = false
        Music.pause()
    }

    function unpause() {
        paused = false
        Music.resume()
    }

    function enemyFire() {
        const bottom = {}
        for (const a of aliens) {
            if (!a.alive) continue
            if (!bottom[a.col] || a.y > bottom[a.col].y) bottom[a.col] = a
        }
        const shooters = Object.values(bottom)
        if (!shooters.length) return
        const s = shooters[Math.floor(Math.random() * shooters.length)]
        shoot({ x: s.x + s.w / 2 - 5, y: s.y + s.h, w: 10, h: 14, vx: 0, vy: diff.enemyBulletSpeed, src: s.type })
    }

    function shoot(b) {
        if (enemyBullets.length >= 80) return
        b.age = 0
        enemyBullets.push(b)
    }

    function bossAttack(kind) {
        const cx = boss.x + boss.w / 2
        const by = boss.y + boss.h
        const v = boss.bulletSpeed
        if (kind === "clippy") {
            const n = 5 + Math.min(4, boss.k - 1)
            for (let i = 0; i < n; i++) {
                const a = Math.PI / 2 + (i - (n - 1) / 2) * 0.22
                shoot({ x: cx - 6, y: by, w: 12, h: 12, vx: Math.cos(a) * v, vy: Math.sin(a) * v, src: kind })
            }
        } else if (kind === "cortanaboss") {
            const n = 2 + Math.floor(Math.random() * 3)
            for (let i = 0; i < n; i++)
                shoot({ x: cx - 8 + (i - (n - 1) / 2) * 60, y: by, w: 16, h: 16, vx: 0, vy: v * 0.6, home: 90, src: kind })
        } else if (kind === "zune") {
            for (let i = 0; i < 5; i++) {
                const x = cx - 6 + (i - 2) * 44
                shoot({ x: x, x0: x, y: by, w: 12, h: 12, vx: 0, vy: v * 0.7, amp: 40, src: kind })
            }
        } else if (kind === "bsod") {
            for (let i = 0; i < 3; i++)
                shoot({ x: 60 + Math.random() * 1120, y: by, w: 40, h: 16, vx: 0, vy: v * 0.6, src: kind })
        } else if (kind === "ieboss") {
            const n = 4 + Math.floor(Math.random() * 3)
            for (let i = 0; i < n; i++)
                shoot({ x: boss.x + (i + 0.5) * boss.w / n - 9, y: by, w: 18, h: 18, vx: 0, vy: 0,
                        stall: 40, fall: 1.8 * v, src: kind })
        } else if (kind === "bob") {
            for (let i = 0; i < 2 && minions.length < 4; i++)
                minions.push({ x: boss.x + Math.random() * (boss.w - 30), y: by - 10, w: 30, h: 24, hp: 1 })
        } else if (kind === "redring") {
            const gap = Math.floor(Math.random() * 12)
            for (let i = 0; i < 14; i++) {
                if (i >= gap && i < gap + 3) continue
                const a = i * Math.PI / 13
                shoot({ x: cx - 6, y: by - 20, w: 12, h: 12, vx: Math.cos(a) * v * 0.8, vy: Math.sin(a) * v * 0.8, src: kind })
            }
        } else if (kind === "teamsboss") {
            let live = 0
            for (const e of enemyBullets) if (e.mute) live++
            const n = Math.min(6 - live, 2 + Math.floor(Math.random() * 2))
            for (let i = 0; i < n; i++) {
                const x = cx - 17 + (i - (n - 1) / 2) * 120
                shoot({ x: x, x0: x, y: by, w: 34, h: 22, vx: 0, vy: v * 0.4, amp: 30, mute: true, src: kind })
            }
        } else if (kind === "kinect") {
            if (beams.length < 2) beams.push({ x: playerX + playerW / 2 - 12, w: 24, tele: 50, active: 15 })
        } else if (kind === "uac") {
            const n = Math.random() < 0.5 ? 1 : 2
            for (let i = 0; i < n && walls.length < 2; i++)
                walls.push({ x: edge + Math.random() * (1280 - 2 * edge - 90), y: by, w: 90, h: 24, hp: 3 })
        } else if (kind === "copilotboss") {
            const seen = {}
            for (const x of shotLog) {
                const key = Math.round(x / 24)
                if (seen[key]) continue
                seen[key] = true
                shoot({ x: x - 3, y: by, w: 10, h: 14, vx: 0, vy: v * 0.8, src: kind })
            }
            for (const d of [-0.3, 0, 0.3]) {
                const a = Math.PI / 2 + d
                shoot({ x: cx - 6, y: by, w: 12, h: 12, vx: Math.cos(a) * v, vy: Math.sin(a) * v, src: kind })
            }
        } else {
            const gap = Math.floor(Math.random() * 7)
            for (let i = 0; i < 8; i++) {
                if (i === gap || i === gap + 1) continue
                shoot({ x: 40 + i * 155, y: by, w: 46, h: 12, vx: 0, vy: v * 0.75, src: "winupdate" })
            }
        }
    }

    function stepMinions() {
        if (!minions.length) return
        const keep = []
        for (const m of minions) {
            if (m.hp <= 0) continue
            m.y += 0.6
            if (m.y + m.h >= dangerY) continue
            if (Math.random() < 0.006)
                shoot({ x: m.x + m.w / 2 - 5, y: m.y + m.h, w: 10, h: 14, vx: 0, vy: diff.enemyBulletSpeed, src: "bob" })
            keep.push(m)
        }
        minions = keep
    }

    function stepWalls() {
        if (!walls.length) return
        const keep = []
        for (const w of walls) {
            w.y += 0.8
            if (w.hp > 0 && w.y + w.h < dangerY) keep.push(w)
        }
        walls = keep
    }

    function stepBeams(player) {
        if (!beams.length) return
        const keep = []
        for (const b of beams) {
            if (b.tele > 0) b.tele--
            else {
                b.active--
                if (player.x < b.x + b.w && b.x < player.x + player.w) hitPlayer()
            }
            if (b.active > 0) keep.push(b)
        }
        beams = keep
    }

    function updateBoss() {
        if (!boss || boss.hp <= 0) return
        boss.x += boss.dir * boss.speed
        boss.y += boss.descend
        if (boss.y + boss.h >= dangerY) {
            endGame()
            return
        }
        if (boss.x < edge || boss.x + boss.w > 1280 - edge) {
            boss.dir *= -1
            boss.x = Math.max(edge, Math.min(1280 - edge - boss.w, boss.x))
        }
        if (boss.flash > 0) boss.flash--
        if (--boss.timer <= 0) {
            const kind = boss.attacks[boss.attackIndex % boss.attacks.length]
            bossAttack(kind)
            boss.attackIndex++
            boss.timer = Logic.attackDelay(kind, boss.attackEvery)
        }
    }

    function steer(b) {
        let best = null, bestD = 1e9
        for (const a of aliens) {
            if (!a.alive || a.y > b.y) continue
            const d = Math.abs(a.x + a.w / 2 - b.x) + (b.y - a.y) * 0.3
            if (d < bestD) { bestD = d; best = a }
        }
        const target = best ? best.x + best.w / 2 : boss && boss.hp > 0 ? boss.x + boss.w / 2 : b.x
        b.vx = Math.max(-6, Math.min(6, b.vx + Math.sign(target - b.x) * 0.6))
    }

    function marchAliens() {
        let alive = 0, minX = 1e9, maxX = -1e9
        for (const a of aliens) {
            if (!a.alive) continue
            alive++
            minX = Math.min(minX, a.x)
            maxX = Math.max(maxX, a.x + a.w)
        }
        if (!alive) return
        const speed = diff.marchSpeed * Logic.marchMultiplier(alive, totalAliens)
        const hitEdge = (marchDir > 0 && maxX + speed > 1280 - edge) || (marchDir < 0 && minX - speed < edge)
        for (const a of aliens) {
            if (!a.alive) continue
            if (hitEdge) a.y += diff.stepDown
            else a.x += marchDir * speed
        }
        if (hitEdge) marchDir *= -1
    }

    function hitBunker(b) {
        if (b.y + b.h < bunkerTop || b.y > bunkerTop + 48) return false
        for (const c of bunkers) {
            if (c.hp > 0 && Logic.rectsOverlap(b, c)) {
                c.hp--
                return true
            }
        }
        return false
    }

    function levelClear() {
        addScore(Logic.levelClearBonus(level, lives))
        play("levelup")
        level += 1
        seed = Math.floor(Math.random() * 2147483647)
        beginLevel()
    }

    function stepParticles() {
        const live = []
        for (const p of particles) {
            p.x += p.vx
            p.y += p.vy
            p.vy += 0.08
            if (--p.life > 0) live.push(p)
        }
        particles = live
        for (let i = 0; i < rain.length; i++) {
            rain[i] += 0.25 + (i % 5) * 0.03
            if (rain[i] * 14 > 720 && Math.random() > 0.985) rain[i] = 0
        }
    }

    function tick() {
        tickCount++
        stepParticles()
        if (paused) return
        if (gameOver) {
            if (gameOverTicks > 0 && --gameOverTicks === 0 && !finishedSent) {
                finishedSent = true
                finished(score, level)
            }
            return
        }
        if (transitioning) {
            if (--bannerTicks <= 0) transitioning = false
            return
        }

        if (moveLeft) playerX = Math.max(edge, playerX - 7)
        if (moveRight) playerX = Math.min(1280 - edge - playerW, playerX + 7)
        if (cooldown > 0) cooldown--
        if (invuln > 0) invuln--
        if (muted > 0) muted--
        if (powerupTicks > 0 && --powerupTicks === 0) powerup = ""
        if (doubleTicks > 0) doubleTicks--
        if (frozen > 0) frozen--
        if (fireHeld) fire()

        const player = { x: playerX, y: playerY, w: playerW, h: playerH }

        const keep = []
        for (const b of bullets) {
            if (b.kind === "homing") steer(b)
            b.y -= 12
            b.x += b.vx
            if (b.y + b.h < 0 || hitBunker(b)) continue
            let hit = false
            for (const w of walls) {
                if (w.hp > 0 && Logic.rectsOverlap(b, w)) {
                    w.hp--
                    play("hit")
                    hit = true
                    break
                }
            }
            if (hit) {
                if (b.kind === "bomb") explode(b.x, b.y)
                continue
            }
            for (const e of enemyBullets) {
                if (e.mute && !e.popped && Logic.rectsOverlap(b, e)) {
                    e.popped = true
                    burst(e.x + e.w / 2, e.y + e.h / 2, "#7b83eb", 8)
                    hit = true
                    break
                }
            }
            if (hit) continue
            const pierce = b.kind === "laser"
            for (const m of minions) {
                if (m.hp > 0 && Logic.rectsOverlap(b, m)) {
                    m.hp = 0
                    addScore(10)
                    burst(m.x + m.w / 2, m.y + m.h / 2, "#ffd400", 8)
                    play("kill")
                    hit = true
                    if (!pierce) break
                }
            }
            if (hit && !pierce) {
                if (b.kind === "bomb") explode(b.x, b.y)
                continue
            }
            hit = false
            for (const a of aliens) {
                if (!a.alive || !Logic.rectsOverlap(b, a)) continue
                if (pierce) {
                    if (b.hits.indexOf(a) >= 0) continue
                    b.hits.push(a)
                    damageAlien(a, 1)
                    continue
                }
                if (b.kind === "bomb") explode(b.x, b.y)
                else damageAlien(a, 1)
                hit = true
                break
            }
            if (!hit && boss && boss.hp > 0 && Logic.rectsOverlap(b, boss)) {
                if (b.kind === "bomb") explode(b.x, b.y)
                else damageBoss(1)
                hit = true
            }
            if (!hit) keep.push(b)
        }
        bullets = keep

        if (frozen === 0) {
            marchAliens()
            updateBoss()
            if (gameOver) return
            if (Math.random() < diff.fireChance) enemyFire()
            stepMinions()
            stepWalls()
            stepBeams(player)
            if (gameOver) return
        }

        const playerCx = playerX + playerW / 2
        const enemyKeep = []
        for (const e of enemyBullets) {
            if (e.popped) continue
            Logic.stepEnemyBullet(e, playerCx)
            if (e.y > 720 || e.x < -60 || e.x > 1340 || hitBunker(e)) continue
            if (Logic.rectsOverlap(e, player)) {
                if (e.mute) {
                    applyMute()
                    continue
                }
                hitPlayer()
                if (gameOver) return
                continue
            }
            enemyKeep.push(e)
        }
        if (invuln < 90) enemyBullets = enemyKeep

        const dropKeep = []
        for (const d of drops) {
            d.y += 2
            if (Logic.rectsOverlap(d, player)) {
                collect(d.type)
                continue
            }
            if (d.y < 720) dropKeep.push(d)
        }
        drops = dropKeep

        let anyAlive = false
        for (const a of aliens) {
            if (!a.alive) continue
            anyAlive = true
            for (const c of bunkers) if (c.hp > 0 && Logic.rectsOverlap(a, c)) c.hp = 0
            if (a.y + a.h >= dangerY) {
                endGame()
                return
            }
        }
        if (!anyAlive && (!boss || boss.hp <= 0)) levelClear()
    }

    Timer {
        interval: 16
        repeat: true
        running: root.visible
        onTriggered: {
            root.tick()
            canvas.requestPaint()
        }
    }

    Connections {
        target: Qt.application
        function onStateChanged() {
            if (Qt.application.state !== Qt.ApplicationActive) root.pause()
        }
    }

    Component.onCompleted: {
        resetRain()
    }

    Keys.onPressed: function(event) {
        const k = event.key
        if (root.paused) {
            if (k === Qt.Key_Up || k === Qt.Key_Down) root.pauseIndex = 1 - root.pauseIndex
            else if (k === Qt.Key_Escape || k === Qt.Key_P) root.unpause()
            else if (k === Qt.Key_Return || k === Qt.Key_Enter || k === Qt.Key_Space) {
                if (root.pauseIndex === 0) root.unpause()
                else root.quitToMenu()
            }
            event.accepted = true
            return
        }
        if (k === Qt.Key_Left || k === Qt.Key_A) root.moveLeft = true
        else if (k === Qt.Key_Right || k === Qt.Key_D) root.moveRight = true
        else if (k === Qt.Key_Space) { root.fireHeld = true; if (!event.isAutoRepeat) root.fire() }
        else if (k === Qt.Key_Escape || k === Qt.Key_P) root.pause()
        else if (k === Qt.Key_M) root.toggleSound()
        else return
        event.accepted = true
    }

    Keys.onReleased: function(event) {
        if (event.isAutoRepeat) return
        const k = event.key
        if (k === Qt.Key_Left || k === Qt.Key_A) root.moveLeft = false
        else if (k === Qt.Key_Right || k === Qt.Key_D) root.moveRight = false
        else if (k === Qt.Key_Space) root.fireHeld = false
        else return
        event.accepted = true
    }

    Canvas {
        id: canvas
        anchors.fill: parent
        renderStrategy: Canvas.Cooperative

        onPaint: {
            const ctx = getContext("2d")
            ctx.fillStyle = root.theme ? root.theme.bg : "#05070a"
            ctx.fillRect(0, 0, width, height)

            ctx.font = "12px monospace"
            ctx.textAlign = "left"
            ctx.textBaseline = "alphabetic"
            for (let i = 0; i < root.rain.length; i++) {
                ctx.fillStyle = Sprites.withAlpha(["#ff5f56", "#ffb454", "#39ff8f", "#5bc0ff", "#c77dff"][i % 5], 0.25)
                ctx.fillText(root.rainGlyphs[Math.floor(Math.random() * root.rainGlyphs.length)], i * 16 + 2, root.rain[i] * 14)
            }

            ctx.strokeStyle = "rgba(255,95,86,0.18)"
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(0, root.dangerY)
            ctx.lineTo(1280, root.dangerY)
            ctx.stroke()

            for (const c of root.bunkers) if (c.hp > 0) Sprites.drawBunkerCell(ctx, c.x, c.y, c.w, c.hp)

            const menace = root.menace()
            const frame = Math.floor(root.tickCount / 30) % 2
            for (const a of root.aliens)
                if (a.alive) Sprites.drawAlien(ctx, a.type, a.x, a.y, a.w, a.h, 1 - a.hp / a.maxHp, menace, frame)

            for (const w of root.walls) Sprites.drawUacWall(ctx, w.x, w.y, w.w, w.h, w.hp)
            for (const m of root.minions) Sprites.drawPuppy(ctx, m.x, m.y, m.w, m.h, frame)
            for (const bm of root.beams) Sprites.drawKinectBeam(ctx, bm.x, bm.w, root.boss ? root.boss.y + root.boss.h : 0, 720, bm.tele, bm.active)

            if (root.boss && root.boss.hp > 0) {
                const b = root.boss
                Sprites.drawBoss(ctx, b.type, b.x, b.y, b.w, b.h, b.hp / b.maxHp, root.tickCount, b.k, b.guest)
                if (b.flash > 0) {
                    ctx.fillStyle = "rgba(255,255,255,0.35)"
                    ctx.fillRect(b.x, b.y, b.w, b.h)
                }
            }

            for (const b of root.bullets) Sprites.drawPlayerBullet(ctx, b.kind, b.x, b.y, b.w, b.h)
            for (const e of root.enemyBullets) Sprites.drawEnemyBullet(ctx, e.src, e.x + e.w / 2, e.y + e.h / 2, e.w, e.h)
            for (const d of root.drops) Sprites.drawPowerup(ctx, d.type, d.x, d.y, d.h)

            if (!root.gameOver && (root.invuln === 0 || Math.floor(root.invuln / 5) % 2 === 0))
                Sprites.drawPlayer(ctx, root.playerX, root.playerY, root.playerW, root.playerH, root.shield, root.tickCount)

            for (const p of root.particles) {
                ctx.globalAlpha = Math.min(1, p.life / 25)
                ctx.fillStyle = p.color
                ctx.fillRect(p.x - 2, p.y - 2, 4, 4)
            }
            ctx.globalAlpha = 1
        }
    }

    Row {
        x: 20
        y: 12
        spacing: 36
        Text { text: "SCORE " + root.score; font.family: "monospace"; font.pixelSize: 22; font.bold: true; color: "#fffded" }
        Text { text: "HI " + root.hiScore; font.family: "monospace"; font.pixelSize: 22; font.bold: true; color: "#fffd6b" }
        Text { text: "LEVEL " + root.level; font.family: "monospace"; font.pixelSize: 22; font.bold: true; color: "#39ff8f" }
    }

    Row {
        anchors.right: parent.right
        anchors.rightMargin: 20
        y: 12
        spacing: 16

        Item {
            visible: root.powerup !== ""
            width: 150
            height: 26
            Text {
                text: ({ sudo: "SUDO SPREAD", pacman: "PACMAN -SYU", bomb: "KILL -9 BOMBS",
                         laser: "GREP LASER", homing: "SSH HOMING" })[root.powerup] || ""
                font.family: "monospace"; font.pixelSize: 14; font.bold: true; color: "#5bc0ff"
            }
            Rectangle {
                y: 20; height: 5; radius: 2; color: "#5bc0ff"
                width: 150 * root.powerupTicks / Logic.POWERUP_TICKS
            }
        }
        Text {
            visible: root.frozen > 0
            text: "SIGSTOP"
            font.family: "monospace"; font.pixelSize: 14; font.bold: true; color: "#80d8ff"
        }
        Text {
            visible: root.doubleTicks > 0
            text: "2X SCORE"
            font.family: "monospace"; font.pixelSize: 14; font.bold: true; color: "#ffd400"
        }
        Text {
            visible: root.muted > 0
            text: "MUTED"
            font.family: "monospace"; font.pixelSize: 14; font.bold: true; color: "#7b83eb"
        }
        Text {
            visible: root.shield
            text: "FIREWALL"
            font.family: "monospace"; font.pixelSize: 14; font.bold: true; color: "#ffb454"
        }
        Text {
            text: "LIVES " + "▲".repeat(Math.max(0, Math.min(root.lives, 8))) + (root.lives > 8 ? "+" : "")
            font.family: "monospace"; font.pixelSize: 22; font.bold: true; color: "#39ff8f"
        }
        Text {
            text: root.soundOn ? "♪" : "♪̸"
            font.pixelSize: 22; color: root.soundOn ? "#fffded" : "#9CA3AF"
        }
        Text {
            text: "♫"
            font.pixelSize: 22; color: root.musicOn ? "#fffded" : "#9CA3AF"
            opacity: root.musicOn ? 1 : 0.5
        }
    }

    Rectangle {
        anchors.fill: parent
        visible: root.transitioning || root.paused || root.gameOver
        color: "#b305070a"

        Column {
            anchors.centerIn: parent
            spacing: 16

            Text {
                anchors.horizontalCenter: parent.horizontalCenter
                text: root.gameOver ? "GAME OVER" : root.paused ? "PAUSED" : root.bannerText
                font.family: "monospace"
                font.pixelSize: 64
                font.bold: true
                color: root.gameOver ? "#ff5f56" : root.boss && root.transitioning ? "#ff5f56" : "#39ff8f"
            }
            Text {
                anchors.horizontalCenter: parent.horizontalCenter
                visible: text !== ""
                text: root.gameOver ? "Reached level " + root.level + "  -  score " + root.score
                                    : root.paused ? "" : root.bannerSub
                font.family: "monospace"
                font.pixelSize: 24
                color: "#fffded"
            }
            Repeater {
                model: root.paused ? ["RESUME", "QUIT TO MENU"] : []
                Text {
                    required property string modelData
                    required property int index
                    anchors.horizontalCenter: parent.horizontalCenter
                    text: (index === root.pauseIndex ? "> " : "  ") + modelData + (index === root.pauseIndex ? " <" : "  ")
                    font.family: "monospace"
                    font.pixelSize: 28
                    font.bold: true
                    color: index === root.pauseIndex ? "#39ff8f" : "#fffded"
                    MouseArea {
                        anchors.fill: parent
                        onClicked: index === 0 ? root.unpause() : root.quitToMenu()
                    }
                }
            }
            Text {
                anchors.horizontalCenter: parent.horizontalCenter
                visible: root.paused
                text: "Progress is saved at the start of each level"
                font.family: "monospace"
                font.pixelSize: 16
                color: "#9CA3AF"
            }
        }
    }
}
