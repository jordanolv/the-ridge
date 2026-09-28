import { Resvg } from '@resvg/resvg-js';
import { createCanvas, loadImage, GlobalFonts, type SKRSContext2D } from '@napi-rs/canvas';
import * as fs from 'fs';
import * as path from 'path';
import { toParisDayYMD } from '../../../shared/time/day-split';
import { getTheme, type ProfileTheme } from './profile-themes';

// Enregistrer Roboto pour un rendu cohérent sur tous les serveurs
GlobalFonts.registerFromPath(path.join(process.cwd(), 'assets/fonts/Roboto-Regular.ttf'), 'Roboto');
GlobalFonts.registerFromPath(path.join(process.cwd(), 'assets/fonts/Roboto-Bold.ttf'), 'Roboto');
GlobalFonts.registerFromPath(path.join(process.cwd(), 'assets/fonts/Roboto-Black.ttf'), 'Roboto');

export interface ProfileCardData {
  themeId?: string;
  pseudo: string;
  bio: string;
  ridgecoin: string;
  level: string;
  messages: string;
  voc: string;
  birthday: string;
  joinedAt: string;
  avatarUrl: string;
  // Données dynamiques pour Canvas
  roles: { name: string; color: string }[];
  weeklyActivity: { date: Date; time: number }[]; // 14 jours d'activité vocale
  mountains: { name: string; unlocked: boolean }[];
  xp: { current: number; required: number; percent: number };
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ParsedPositions {
  roleBox: Box;
  mountainBox: Box;
  levelBox: Box;
  activityBox: Box;
  pseudoCenter: { x: number; y: number };
  bioCenter: { x: number; y: number };
  avatar: { cx: number; cy: number; rx: number; ry: number };
}

export class ProfileCardService {
  private static templateCache = new Map<string, string>();
  private static positionsCache = new Map<string, ParsedPositions>();

  private static readonly SVG_WIDTH = 1500;
  private static readonly SVG_HEIGHT = 900;

  // Valeurs par défaut si parsing échoue
  private static readonly DEFAULT_POSITIONS: ParsedPositions = {
    roleBox:     { x: 65,  y: 54,  width: 813, height: 155 },
    mountainBox: { x: 472, y: 232, width: 407, height: 102 },
    levelBox:    { x: 65,  y: 232, width: 407, height: 102 },
    activityBox: { x: 65,  y: 360, width: 813, height: 490 },
    pseudoCenter: { x: 1211, y: 279 },
    bioCenter:    { x: 1211, y: 321 },
    avatar: { cx: 1211, cy: 145, rx: 104, ry: 100 }
  };


  private static getTemplate(theme: ProfileTheme): string {
    const cached = this.templateCache.get(theme.id);
    if (cached) return cached;

    const svg = fs.readFileSync(theme.file, 'utf-8');
    this.templateCache.set(theme.id, svg);
    this.positionsCache.delete(theme.id);
    return svg;
  }

  /**
   * Parse le SVG pour extraire dynamiquement les positions des blocs
   * Utilise les id Figma (ex: id="{{LEVELBOX}}") quand disponibles
   */
  private static getPositions(theme: ProfileTheme, svg: string): ParsedPositions {
    const cached = this.positionsCache.get(theme.id);
    if (cached) return cached;

    // Extrait une Box depuis un path rectangulaire "MX YH...V..."
    const parsePathBox = (d: string): Box | null => {
      const m = d.match(/M(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)H(\d+(?:\.\d+)?)V(\d+(?:\.\d+)?)/);
      if (!m) return null;
      const x = parseFloat(m[1]), y = parseFloat(m[2]);
      return { x, y, width: parseFloat(m[3]) - x, height: parseFloat(m[4]) - y };
    };

    // Cherche une Box par id Figma (ex: {{ROLE}}, {{LEVELBOX}}, ...)
    const findBoxById = (id: string): Box | null => {
      // <path id="{{ID}}" d="..."/>
      const pathMatch = svg.match(new RegExp(`<path[^>]*id="\\{\\{${id}\\}\\}"[^>]*d="([^"]+)"`, 'i'));
      if (pathMatch) return parsePathBox(pathMatch[1]);
      // <rect id="{{ID}}" x="..." y="..." width="..." height="..."/>
      const rectMatch = svg.match(new RegExp(`<rect[^>]*id="\\{\\{${id}\\}\\}"[^>]*x="([^"]+)"[^>]*y="([^"]+)"[^>]*width="([^"]+)"[^>]*height="([^"]+)"`, 'i'));
      if (rectMatch) return { x: parseFloat(rectMatch[1]), y: parseFloat(rectMatch[2]), width: parseFloat(rectMatch[3]), height: parseFloat(rectMatch[4]) };
      // <g id="{{ID}}"><path d="..."/> — prend le premier path enfant
      const groupMatch = svg.match(new RegExp(`<g[^>]*id="\\{\\{${id}\\}\\}"[^>]*>[\\s\\S]*?<path[^>]*d="([^"]+)"`, 'i'));
      if (groupMatch) return parsePathBox(groupMatch[1]);
      return null;
    };

    // Trouver l'ellipse de l'avatar (par id Figma ou par fill="#D9D9D9")
    let avatar = this.DEFAULT_POSITIONS.avatar;
    const ellipseById = svg.match(/<ellipse[^>]*id="[^"]*AVATAR[^"]*"[^>]*cx="(\d+(?:\.\d+)?)"[^>]*cy="(\d+(?:\.\d+)?)"[^>]*rx="(\d+(?:\.\d+)?)"[^>]*ry="(\d+(?:\.\d+)?)"/i);
    const ellipseByFill = svg.match(/<ellipse cx="(\d+(?:\.\d+)?)" cy="(\d+(?:\.\d+)?)" rx="(\d+(?:\.\d+)?)" ry="(\d+(?:\.\d+)?)" fill="#D9D9D9"/);
    const ellipseMatch = ellipseById || ellipseByFill;
    if (ellipseMatch) {
      avatar = {
        cx: parseFloat(ellipseMatch[1]),
        cy: parseFloat(ellipseMatch[2]),
        rx: parseFloat(ellipseMatch[3]),
        ry: parseFloat(ellipseMatch[4])
      };
    }

    // Trouver les positions du pseudo et de la bio
    let pseudoCenter = this.DEFAULT_POSITIONS.pseudoCenter;
    let bioCenter = this.DEFAULT_POSITIONS.bioCenter;
    const pseudoMatch = svg.match(/<tspan x="(\d+(?:\.\d+)?)" y="(\d+(?:\.\d+)?)">\{\{PSEUDO\}\}<\/tspan>/);
    if (pseudoMatch) pseudoCenter = { x: avatar.cx, y: parseFloat(pseudoMatch[2]) };
    const bioMatch = svg.match(/<tspan x="(\d+(?:\.\d+)?)" y="(\d+(?:\.\d+)?)">\{\{BIO\}\}<\/tspan>/);
    if (bioMatch) bioCenter = { x: avatar.cx, y: parseFloat(bioMatch[2]) };

    const positions: ParsedPositions = {
      roleBox:     findBoxById('ROLE')     || this.DEFAULT_POSITIONS.roleBox,
      mountainBox: findBoxById('MONTAGNE') || this.DEFAULT_POSITIONS.mountainBox,
      levelBox:    findBoxById('LEVELBOX') || this.DEFAULT_POSITIONS.levelBox,
      activityBox: findBoxById('ACTIVITY') || this.DEFAULT_POSITIONS.activityBox,
      pseudoCenter,
      bioCenter,
      avatar
    };

    this.positionsCache.set(theme.id, positions);
    return positions;
  }

  static async generateCard(data: ProfileCardData): Promise<Buffer> {
    const theme = getTheme(data.themeId);
    const svg = this.getTemplate(theme);
    const positions = this.getPositions(theme, svg);

    // 1. Générer l'image SVG avec les textes remplacés directement
    const svgBuffer = await this.generateSvgImage(data, svg, positions);

    // 2. Créer un canvas pour superposer les éléments dynamiques
    const canvas = createCanvas(this.SVG_WIDTH, this.SVG_HEIGHT);
    const ctx = canvas.getContext('2d');

    // 3. Dessiner le SVG comme fond
    const svgImage = await loadImage(svgBuffer);
    ctx.drawImage(svgImage, 0, 0, this.SVG_WIDTH, this.SVG_HEIGHT);

    // 4. Dessiner les éléments dynamiques Canvas
    this.drawRoles(ctx, data.roles, positions.roleBox);
    this.drawMountains(ctx, data.mountains, positions.mountainBox);
    this.drawLevel(ctx, data.level, data.xp, positions.levelBox);
    this.drawActivityChart(ctx, data.weeklyActivity, positions.activityBox);

    return canvas.toBuffer('image/png');
  }

  private static async generateSvgImage(data: ProfileCardData, svgTemplate: string, positions: ParsedPositions): Promise<Buffer> {
    let svg = svgTemplate.replace(/font-family="Inter"/g, 'font-family="Roboto"');
    const { avatar, pseudoCenter, bioCenter } = positions;

    // Télécharger l'avatar et le convertir en base64
    const avatarBase64 = await this.fetchImageAsBase64(data.avatarUrl);

    // Remplacer l'ellipse avatar (id="{{AVATAR}}") par une image avec clip-path circulaire
    svg = svg.replace(
      /<ellipse[^>]*id="[^"]*AVATAR[^"]*"[^>]*\/>/i,
      `<defs>
        <clipPath id="avatarClip">
          <ellipse cx="${avatar.cx}" cy="${avatar.cy}" rx="${avatar.rx}" ry="${avatar.ry}"/>
        </clipPath>
      </defs>
      <image
        x="${avatar.cx - avatar.rx}"
        y="${avatar.cy - avatar.ry}"
        width="${avatar.rx * 2}"
        height="${avatar.ry * 2}"
        href="${avatarBase64}"
        clip-path="url(#avatarClip)"
        preserveAspectRatio="xMidYMid slice"
      />`
    );

    // Remplacer le pseudo centré (remplace l'attribut x existant et le contenu)
    svg = svg.replace(
      /(<text[^>]*id="\{\{PSEUDO\}\}"[^>]*>[\s\S]*?<tspan\s)x="[^"]*"([^>]*)>\{\{PSEUDO\}\}(<\/tspan>)/,
      `$1x="${pseudoCenter.x}"$2 text-anchor="middle">${this.escapeXml(data.pseudo)}$3`
    );

    // Remplacer la bio centrée
    svg = svg.replace(
      /(<text[^>]*id="\{\{BIO\}\}"[^>]*>[\s\S]*?<tspan\s)x="[^"]*"([^>]*)>\{\{BIO\}\}(<\/tspan>)/,
      `$1x="${bioCenter.x}"$2 text-anchor="middle">${this.escapeXml(this.truncateBio(data.bio, 42))}$3`
    );

    // Remplacer les placeholders texte simples
    const replacements: Record<string, string> = {
      '{{RIDGECOIN}}': data.ridgecoin,
      '{{LEVEL}}':     data.level,
      '{{MESSAGES}}':  data.messages,
      '{{VOC}}':       data.voc,
      '{{B}}':         data.birthday,
      '{{ICI}}':       data.joinedAt,
    };
    for (const [placeholder, value] of Object.entries(replacements)) {
      svg = svg.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), this.escapeXml(value));
    }

    // Rendre le SVG en PNG
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: this.SVG_WIDTH },
      font: {
        loadSystemFonts: true,
        fontFiles: [
          path.join(process.cwd(), 'assets/fonts/Roboto-Regular.ttf'),
          path.join(process.cwd(), 'assets/fonts/Roboto-Bold.ttf'),
          path.join(process.cwd(), 'assets/fonts/Roboto-Black.ttf'),
        ],
        defaultFontFamily: 'Roboto',
      }
    });

    const pngData = resvg.render();
    return pngData.asPng();
  }

  private static drawRoles(ctx: SKRSContext2D, roles: { name: string; color: string }[], box: Box): void {
    const { x, y, width, height } = box;

    // Tailles dynamiques basées sur la hauteur de la box
    const badgeHeight = height * 0.21; // ~21% de la hauteur de la box
    const fontSize = badgeHeight * 0.5; // Font proportionnelle à la hauteur du badge
    const badgeGap = width * 0.01; // 1% de la largeur
    const rowGap = height * 0.05; // 5% de la hauteur
    const padding = width * 0.025; // 2.5% de la largeur


    ctx.font = `${fontSize}px Roboto, Arial, sans-serif`;

    // Organiser les rôles en lignes tant qu'on reste dans la zone
    const rows: { name: string; color: string; width: number }[][] = [];
    let currentRow: { name: string; color: string; width: number }[] = [];
    let currentRowWidth = 0;
    const maxRowWidth = width - padding * 2;
    const maxRows = Math.floor((height - padding) / (badgeHeight + rowGap));

    // Supprime les emotes custom Discord (:nom:) et les emojis unicode des noms de rôles
    const cleanRoleName = (name: string): string =>
      this.sanitizeText(name)
        .replace(/<a?:[^:]+:\d+>/g, '')
        .replace(/[\u{1F000}-\u{1FFFF}|\u{2600}-\u{27BF}|\u{1F300}-\u{1F9FF}]/gu, '')
        .trim();

    const dotRadius = badgeHeight * 0.18;
    const dotDiameter = dotRadius * 2;
    const dotMarginLeft = badgeHeight * 0.35;  // marge gauche avant le rond
    const dotMarginRight = fontSize * 0.35;    // marge entre le rond et le texte
    const paddingRight = badgeHeight * 0.4;    // marge droite

    for (const role of roles) {
      const label = cleanRoleName(role.name);
      const badgeWidth = dotMarginLeft + dotDiameter + dotMarginRight + ctx.measureText(label).width + paddingRight;

      if (currentRowWidth + badgeWidth + badgeGap > maxRowWidth && currentRow.length > 0) {
        rows.push(currentRow);
        if (rows.length >= maxRows) break;
        currentRow = [];
        currentRowWidth = 0;
      }

      currentRow.push({ name: label, color: role.color, width: badgeWidth });
      currentRowWidth += badgeWidth + badgeGap;
    }

    if (currentRow.length > 0 && rows.length < maxRows) {
      rows.push(currentRow);
    }

    const displayedRoles = rows.reduce((sum, row) => sum + row.length, 0);
    const remainingRoles = roles.length - displayedRoles;

    const totalHeight = rows.length * badgeHeight + (rows.length - 1) * rowGap;
    let currentY = y + (height - totalHeight) / 2 + badgeHeight / 2;

    rows.forEach((row) => {
      const rowWidth = row.reduce((sum, r) => sum + r.width, 0) + (row.length - 1) * badgeGap;
      let currentX = x + (width - rowWidth) / 2;

      row.forEach((role) => {
        const roleColor = role.color === '#000000' ? '#5865F2' : role.color;
        const borderRadius = badgeHeight / 2;
        const badgeX = currentX;
        const badgeY = currentY - badgeHeight / 2;
        const dotX = badgeX + dotMarginLeft + dotRadius;
        const dotY = currentY;
        const textX = dotX + dotRadius + dotMarginRight;

        // Glassmorphism — fond blanc très transparent
        ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
        this.roundRect(ctx, badgeX, badgeY, role.width, badgeHeight, borderRadius);
        ctx.fill();

        // Bordure glassmorphism subtile
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = Math.max(1, badgeHeight * 0.04);
        this.roundRect(ctx, badgeX, badgeY, role.width, badgeHeight, borderRadius);
        ctx.stroke();

        // Petit rond coloré
        ctx.beginPath();
        ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
        ctx.fillStyle = roleColor;
        ctx.fill();

        // Texte
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.font = `${fontSize}px Roboto, Arial, sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText(role.name, textX, currentY + fontSize * 0.35);

        currentX += role.width + badgeGap;
      });

      currentY += badgeHeight + rowGap;
    });

    // +X autres si des rôles restent
    if (remainingRoles > 0) {
      ctx.fillStyle = '#8892b0';
      ctx.font = `${fontSize * 0.9}px Roboto, Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(`+${remainingRoles} autre${remainingRoles > 1 ? 's' : ''}`, x + width / 2, y + height - height * 0.06);
      ctx.textAlign = 'left';
    }
  }

  private static drawActivityChart(ctx: SKRSContext2D, activity: { date: Date; time: number }[], box: Box): void {
    const { x, y, width, height } = box;
    const paddingX = width * 0.04;
    const paddingTop = height * 0.15;
    const paddingBottom = height * 0.18;

    const chartX = x + paddingX;
    const chartW = width - paddingX * 2;
    const chartY = y + paddingTop;
    const chartH = height - paddingTop - paddingBottom;
    const baseY = chartY + chartH;

    // Construire 7 jours glissants (semaine courante) et 7 précédents — en jour Paris
    const todayYMD = toParisDayYMD(new Date());
    const [ty, tm, td] = todayYMD.split('-').map(Number);
    const dayAt = (offset: number) => new Date(Date.UTC(ty, tm - 1, td - offset, 12, 0, 0));
    const toKey = (d: Date) => toParisDayYMD(d);
    const byDay = new Map(activity.map(e => [toKey(e.date), e.time]));

    const currentWeek: { date: Date; time: number }[] = [];
    const prevWeek: { date: Date; time: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dc = dayAt(i);
      const dp = dayAt(i + 7);
      currentWeek.push({ date: dc, time: byDay.get(toKey(dc)) ?? 0 });
      prevWeek.push({ date: dp, time: byDay.get(toKey(dp)) ?? 0 });
    }

    const maxVal = Math.max(...currentWeek.map(d => d.time), ...prevWeek.map(d => d.time), 1);
    const n = 7;
    const stepX = chartW / (n - 1);

    const getPoint = (i: number, val: number) => ({
      px: chartX + i * stepX,
      py: baseY - (val / maxVal) * chartH
    });

    const drawArea = (data: { time: number }[], fillColor: string, strokeColor: string, lineWidth: number) => {
      const pts = data.map((d, i) => getPoint(i, d.time));

      // Area fill
      ctx.beginPath();
      ctx.moveTo(pts[0].px, baseY);
      ctx.lineTo(pts[0].px, pts[0].py);
      for (let i = 1; i < pts.length; i++) {
        const cp1x = pts[i-1].px + stepX * 0.4;
        const cp2x = pts[i].px - stepX * 0.4;
        ctx.bezierCurveTo(cp1x, pts[i-1].py, cp2x, pts[i].py, pts[i].px, pts[i].py);
      }
      ctx.lineTo(pts[pts.length-1].px, baseY);
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();

      // Stroke line
      ctx.beginPath();
      ctx.moveTo(pts[0].px, pts[0].py);
      for (let i = 1; i < pts.length; i++) {
        const cp1x = pts[i-1].px + stepX * 0.4;
        const cp2x = pts[i].px - stepX * 0.4;
        ctx.bezierCurveTo(cp1x, pts[i-1].py, cp2x, pts[i].py, pts[i].px, pts[i].py);
      }
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    };

    const accentColor = '#6EA9C3';

    // Semaine précédente (grise, derrière)
    drawArea(prevWeek, 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.2)', 1.5);

    // Semaine courante (devant)
    const grad = ctx.createLinearGradient(chartX, chartY, chartX, baseY);
    grad.addColorStop(0, 'rgba(110,169,195,0.35)');
    grad.addColorStop(1, 'rgba(110,169,195,0.02)');
    drawArea(currentWeek, grad as unknown as string, accentColor, 2.5);

    // Points + valeurs semaine courante
    const labelFontSize = height * 0.055;
    const dateFontSize  = height * 0.048;
    const legendFontSize = height * 0.05;
    const dayNames = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

    currentWeek.forEach((d, i) => {
      const { px, py } = getPoint(i, d.time);
      const dayIdx = (currentWeek[i].date.getUTCDay() + 6) % 7; // 0=Lun

      // Point
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = accentColor;
      ctx.fill();

      // Valeur au-dessus si > 0
      if (d.time > 0) {
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${labelFontSize}px Roboto, Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(this.formatDuration(d.time), px, py - height * 0.04);
      }

      // Jour en bas
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = `${dateFontSize}px Roboto, Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(dayNames[dayIdx], px, baseY + height * 0.08);
    });

    // Légende tout en bas
    const legendY = y + height - height * 0.02;
    ctx.font = `bold ${legendFontSize}px Roboto, Arial, sans-serif`;

    ctx.fillStyle = accentColor;
    ctx.textAlign = 'left';
    ctx.fillText('● Cette semaine', chartX, legendY);

    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.textAlign = 'right';
    ctx.fillText('● Semaine précédente', chartX + chartW, legendY);

    ctx.textAlign = 'left';
  }

  private static drawLevel(ctx: SKRSContext2D, level: string, xp: { current: number; required: number; percent: number }, box: Box): void {
    const { x, y, width, height } = box;
    const paddingX = width * 0.06;
    const innerWidth = width - paddingX * 2;

    // --- Titre + level (mêmes ratios que drawMountains) ---
    const titleFontSize = height * 0.18;
    const titleY = y + height * 0.28;

    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `${titleFontSize}px Roboto, Arial, sans-serif`;
    ctx.fillText('Niveau', x + paddingX, titleY);

    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `bold ${titleFontSize}px Roboto, Arial, sans-serif`;
    ctx.fillText(`${level}`, x + width - paddingX, titleY);

    // --- Barre XP (mêmes ratios que drawMountains) ---
    const barHeight = height * 0.28;
    const barY = y + height * 0.48;
    const barRadius = barHeight / 2;

    // Fond glassmorphism
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    this.roundRect(ctx, x + paddingX, barY, innerWidth, barHeight, barRadius);
    ctx.fill();

    // Bordure
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    this.roundRect(ctx, x + paddingX, barY, innerWidth, barHeight, barRadius);
    ctx.stroke();

    // Fill XP avec gradient doré
    if (xp.percent > 0) {
      const fillWidth = Math.max(barHeight, innerWidth * xp.percent);
      const gradient = ctx.createLinearGradient(x + paddingX, barY, x + paddingX + fillWidth, barY);
      gradient.addColorStop(0, '#f7971e');
      gradient.addColorStop(1, '#ffd200');
      ctx.fillStyle = gradient;
      this.roundRect(ctx, x + paddingX, barY, fillWidth, barHeight, barRadius);
      ctx.fill();
    }

    // XP dans la barre (mêmes ratios que drawMountains)
    const pctFontSize = barHeight * 0.55;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${pctFontSize}px Roboto, Arial, sans-serif`;
    ctx.fillText(
      `${xp.current.toLocaleString('fr-FR')} / ${xp.required.toLocaleString('fr-FR')} XP`,
      x + paddingX + innerWidth / 2,
      barY + barHeight * 0.68
    );

    ctx.textAlign = 'left';
  }

  private static drawMountains(ctx: SKRSContext2D, mountains: { name: string; unlocked: boolean }[], box: Box): void {
    const { x, y, width, height } = box;

    const unlockedCount = mountains.filter(m => m.unlocked).length;
    const totalCount = mountains.length;
    const progress = totalCount > 0 ? unlockedCount / totalCount : 0;

    const paddingX = width * 0.06;
    const innerWidth = width - paddingX * 2;

    // --- Titre + compteur ---
    const titleFontSize = height * 0.18;
    const titleY = y + height * 0.28;

    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `${titleFontSize}px Roboto, Arial, sans-serif`;
    ctx.fillText('Montagnes', x + paddingX, titleY);

    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `bold ${titleFontSize}px Roboto, Arial, sans-serif`;
    ctx.fillText(`${unlockedCount} / ${totalCount}`, x + width - paddingX, titleY);

    // --- Barre de progression ---
    const barHeight = height * 0.28;
    const barY = y + height * 0.48;
    const barRadius = barHeight / 2;

    // Fond glassmorphism
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    this.roundRect(ctx, x + paddingX, barY, innerWidth, barHeight, barRadius);
    ctx.fill();

    // Bordure
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    this.roundRect(ctx, x + paddingX, barY, innerWidth, barHeight, barRadius);
    ctx.stroke();

    // Fill progressif
    if (progress > 0) {
      const fillWidth = Math.max(barHeight, innerWidth * progress); // min = capsule complète
      const gradient = ctx.createLinearGradient(x + paddingX, barY, x + paddingX + fillWidth, barY);
      gradient.addColorStop(0, '#36E0BE');
      gradient.addColorStop(1, '#4facfe');
      ctx.fillStyle = gradient;
      this.roundRect(ctx, x + paddingX, barY, fillWidth, barHeight, barRadius);
      ctx.fill();
    }

    // Pourcentage centré dans la barre
    const pctFontSize = barHeight * 0.55;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${pctFontSize}px Roboto, Arial, sans-serif`;
    ctx.fillText(`${Math.round(progress * 100)}%`, x + paddingX + innerWidth / 2, barY + barHeight * 0.68);

    ctx.textAlign = 'left';
  }


  private static roundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  private static formatDuration(seconds: number): string {
    if (!seconds || seconds <= 0) return '0';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours >= 1) {
      return `${hours}h`;
    }
    if (minutes >= 1) {
      return `${minutes}m`;
    }
    return `${Math.floor(seconds)}s`;
  }

  private static truncateBio(bio: string, maxLength: number): string {
    if (bio.length <= maxLength) return bio;
    return bio.substring(0, maxLength - 3) + '...';
  }

  private static async fetchImageAsBase64(url: string): Promise<string> {
    // Valider l'URL avant de fetch
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      console.warn(`[ProfileCard] URL d'avatar invalide: "${url}", utilisation d'un placeholder`);
      return this.getDefaultAvatarBase64();
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`[ProfileCard] Erreur fetch avatar: ${response.status}, utilisation d'un placeholder`);
        return this.getDefaultAvatarBase64();
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString('base64');
      const contentType = response.headers.get('content-type') || 'image/png';
      return `data:${contentType};base64,${base64}`;
    } catch (error) {
      console.warn(`[ProfileCard] Erreur fetch avatar:`, error);
      return this.getDefaultAvatarBase64();
    }
  }

  private static getDefaultAvatarBase64(): string {
    // SVG simple gris comme placeholder
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <rect width="256" height="256" fill="#36393f"/>
      <circle cx="128" cy="100" r="50" fill="#5865F2"/>
      <ellipse cx="128" cy="220" rx="70" ry="50" fill="#5865F2"/>
    </svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  }

  private static sanitizeText(text: string): string {
    return text
      .replace(/[\u3164\uFFA0\u115F\u1160]/g, '')        // Hangul fillers
      .replace(/[\u200B-\u200F\u2060\uFEFF]/g, '')        // Zero-width / BOM / word joiner
      .replace(/[\u00AD\u034F\u17B4\u17B5]/g, '')         // Soft hyphen, combining grapheme, Khmer
      .replace(/[\u2028\u2029]/g, '')                      // Line/paragraph separators
      .replace(/[\u2800]/g, '')                            // Braille blank
      .replace(/[\u180E\u061C\u2066-\u2069]/g, '')        // Mongolian vowel, bidi isolates
      .trim();
  }

  private static escapeXml(text: string): string {
    return this.sanitizeText(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private static escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  static clearCache(): void {
    this.templateCache.clear();
    this.positionsCache.clear();
  }
}
