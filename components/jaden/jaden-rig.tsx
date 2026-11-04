/**
 * Jaden's SVG rig.
 * Every face part for every mood is always present; classes on the wrapper (see jaden.css)
 * decide which parts show and how the head is posed. Do not restyle parts here — moods,
 * gestures and entrances are driven entirely by CSS classes.
 */
import { EDGE_Y, VIEWBOX } from './jaden.config'

const FUR_DARK = 'oklch(56% 0.085 52)'
const INK = 'oklch(34% 0.05 40)'
const EYE = 'oklch(20% 0.02 40)'
const LID = 'oklch(77% 0.08 68)'
const PAW = 'oklch(88% 0.04 76)'
const ARM = 'oklch(68% 0.09 60)'
const LINE = 'oklch(38% 0.06 42 / .38)'
const PAW_LINE = 'oklch(62% 0.07 55)'
const MOUTH = 'oklch(30% 0.06 25)'
const HEAD =
  'M38 82 C38 58 56 45 80 45 C104 45 122 58 122 82 C122 102 104 114 80 114 C56 114 38 102 38 82Z'

const inkStroke = { fill: 'none', stroke: INK, strokeLinecap: 'round' } as const
const eyeStroke = { fill: 'none', stroke: EYE, strokeLinecap: 'round' } as const

function star(cx: number, cy: number, r: number) {
  return `M${cx} ${cy - r} Q${cx} ${cy} ${cx + r} ${cy} Q${cx} ${cy} ${cx} ${cy + r} Q${cx} ${cy} ${cx - r} ${cy} Q${cx} ${cy} ${cx} ${cy - r}Z`
}

function Eyes({
  dx = 0,
  dy = 0,
  r = 5.6,
  hl = 2.1,
  lids = true,
  cls,
}: {
  dx?: number
  dy?: number
  r?: number
  hl?: number
  lids?: boolean
  cls: string
}) {
  const points = [
    [62 + dx, 82 + dy],
    [98 + dx, 82 + dy],
  ] as const
  return (
    <g className={`v ${cls}`}>
      <g className="mc-look">
        {points.map(([x, y]) => (
          <g key={x}>
            <circle cx={x} cy={y} r={r} fill={EYE} />
            <circle cx={x + 2} cy={y - 2} r={hl} fill="#fff" />
            <circle cx={x - 1.4} cy={y + 2.4} r={0.9} fill="#fff" opacity={0.8} />
          </g>
        ))}
      </g>
      {lids && (
        <>
          <rect
            className="mc-lid mc-lid-l"
            x={55 + dx}
            y={75 + dy}
            width={14}
            height={14}
            rx={6.5}
            fill={LID}
          />
          <rect
            className="mc-lid mc-lid-r"
            x={91 + dx}
            y={75 + dy}
            width={14}
            height={14}
            rx={6.5}
            fill={LID}
          />
        </>
      )}
    </g>
  )
}

function Steam({ small = false }: { small?: boolean }) {
  return (
    <g
      className="mc-steam"
      fill="none"
      stroke="oklch(84% 0.02 80)"
      strokeWidth={small ? 1.8 : 2}
      strokeLinecap="round"
    >
      {small ? (
        <>
          <path d="M70 86 q-2.5 -4 0 -7 q2.5 -3 0 -6" />
          <path d="M76 85 q-2.5 -4 0 -7 q2.5 -3 0 -6" />
          <path d="M82 86 q-2.5 -4 0 -7 q2.5 -3 0 -6" />
        </>
      ) : (
        <>
          <path d="M23 111 q-3 -5 0 -9 q3 -4 0 -8" />
          <path d="M30 110 q-3 -5 0 -9 q3 -4 0 -8" />
          <path d="M37 111 q-3 -5 0 -9 q3 -4 0 -8" />
        </>
      )}
    </g>
  )
}

export function JadenRig({ uid, width }: { uid: string; width: number }) {
  const h = Math.round(((width * VIEWBOX.height) / VIEWBOX.width) * 10) / 10
  const id = (name: string) => `mc${name}-${uid}`
  const url = (name: string) => `url(#${id(name)})`

  return (
    <svg
      width={width}
      height={h}
      viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={id('Clip')}>
          <rect x={-40} y={-80} width={240} height={EDGE_Y + 80} />
        </clipPath>
        <radialGradient id={id('Fur')} cx=".38" cy=".3" r=".9">
          <stop offset="0%" stopColor="oklch(83% 0.075 72)" />
          <stop offset="55%" stopColor="oklch(71% 0.09 62)" />
          <stop offset="100%" stopColor="oklch(56% 0.09 50)" />
        </radialGradient>
        <linearGradient id={id('Shade')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="45%" stopColor="oklch(40% 0.06 40)" stopOpacity="0" />
          <stop offset="100%" stopColor="oklch(40% 0.06 40)" stopOpacity=".32" />
        </linearGradient>
        <radialGradient id={id('Muz')} cx=".45" cy=".35" r=".8">
          <stop offset="0%" stopColor="oklch(88% 0.04 74)" />
          <stop offset="100%" stopColor="oklch(77% 0.05 62)" />
        </radialGradient>
        <radialGradient id={id('Shadow')}>
          <stop offset="0%" stopColor="#000" stopOpacity=".32" />
          <stop offset="100%" stopColor="#000" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Behind the edge (clipped at y = EDGE_Y) */}
      <g clipPath={url('Clip')}>
        <g className="mc-peek">
          <g className="mc-hop">
            <g className="mc-stretch">
              <g className="mc-breathe">
                <ellipse cx={80} cy={154} rx={58} ry={44} fill={url('Fur')} />
                <ellipse cx={80} cy={154} rx={58} ry={44} fill={url('Shade')} />
                <ellipse
                  cx={80}
                  cy={142}
                  rx={28}
                  ry={20}
                  fill="oklch(85% 0.04 72)"
                  opacity={0.75}
                />
                <ellipse
                  cx={80}
                  cy={154}
                  rx={58}
                  ry={44}
                  fill="none"
                  stroke={LINE}
                  strokeWidth={1.3}
                />

                <g className="mc-pose">
                  <g className="mc-head">
                    <g className="mc-ear-l">
                      <circle cx={51} cy={53} r={11} fill={FUR_DARK} />
                      <circle cx={52} cy={54.5} r={6} fill="oklch(86% 0.05 40)" />
                    </g>
                    <g className="mc-ear-r">
                      <circle cx={109} cy={53} r={11} fill={FUR_DARK} />
                      <circle cx={108} cy={54.5} r={6} fill="oklch(86% 0.05 40)" />
                    </g>
                    <path d={HEAD} fill={url('Fur')} />
                    <path d={HEAD} fill={url('Shade')} />
                    <g
                      fill="none"
                      stroke="oklch(46% 0.07 44)"
                      strokeOpacity={0.45}
                      strokeWidth={1.4}
                      strokeLinecap="round"
                    >
                      <path d="M39.5 90 q-2.5 2 -1 5" />
                      <path d="M120.5 90 q2.5 2 1 5" />
                    </g>
                    <path d={HEAD} fill="none" stroke={LINE} strokeWidth={1.3} />
                    <path
                      d="M80 50 C79 60 79 72 80 84"
                      fill="none"
                      stroke="oklch(48% 0.07 50)"
                      strokeOpacity={0.45}
                      strokeWidth={1.2}
                      strokeDasharray="2.4 2.6"
                      strokeLinecap="round"
                    />
                    <path
                      d="M71 47.5 Q74 39 80 46 Q85 39 89 47.5"
                      fill="none"
                      stroke={FUR_DARK}
                      strokeWidth={2.2}
                      strokeLinecap="round"
                    />
                    <g className="mc-leaf">
                      <path
                        d="M80 46 Q78.5 37 82 30"
                        fill="none"
                        stroke="var(--sage-700)"
                        strokeWidth={2.2}
                        strokeLinecap="round"
                      />
                      <path
                        d="M82 31 C87 21 99 21 103 25 C98 34 87 36 82 31Z"
                        fill="var(--sage-500)"
                      />
                      <path
                        d="M83 30.5 Q92 27 100 25.5"
                        fill="none"
                        stroke="var(--sage-700)"
                        strokeWidth={0.9}
                        strokeOpacity={0.6}
                      />
                      <path
                        d="M81 35 C75 28 67 29 65 32 C70 38 77 38 81 35Z"
                        fill="var(--sage-200)"
                      />
                    </g>
                    <ellipse
                      className="mc-cheek"
                      cx={54}
                      cy={95}
                      rx={7.5}
                      ry={4.5}
                      fill="var(--rose-500)"
                      opacity={0.3}
                    />
                    <ellipse
                      className="mc-cheek"
                      cx={106}
                      cy={95}
                      rx={7.5}
                      ry={4.5}
                      fill="var(--rose-500)"
                      opacity={0.3}
                    />
                    <ellipse cx={80} cy={97} rx={16.5} ry={12} fill={url('Muz')} />
                    <path
                      d="M73.5 90 C73.5 87.6 76.5 87 80 87 C83.5 87 86.5 87.6 86.5 90 C86.5 93 83 96 80 96 C77 96 73.5 93 73.5 90Z"
                      fill={INK}
                    />
                    <ellipse cx={77.6} cy={89} rx={2.4} ry={0.9} fill="#fff" opacity={0.5} />
                    <path d="M80 96 V100.5" {...inkStroke} strokeWidth={1.5} />

                    {/* mouths */}
                    <path
                      className="v m-w"
                      d="M75 101 Q77.5 104 80 101 Q82.5 104 85 101"
                      {...inkStroke}
                      strokeWidth={1.6}
                    />
                    <path
                      className="v m-smile"
                      d="M73 100.5 Q76.5 106.5 80 101 Q83.5 106.5 87 100.5"
                      {...inkStroke}
                      strokeWidth={1.7}
                    />
                    <ellipse className="v m-o" cx={80} cy={103.5} rx={2.6} ry={3.1} fill={MOUTH} />
                    <g className="v m-yawn">
                      <ellipse cx={80} cy={104} rx={5} ry={6.5} fill={MOUTH} />
                      <ellipse cx={80} cy={107.6} rx={3.2} ry={2} fill="var(--rose-500)" />
                    </g>
                    <path
                      className="v m-flat"
                      d="M75.5 102.5 Q78 101.3 80 102.5 Q82 103.7 84.5 102.5"
                      {...inkStroke}
                      strokeWidth={1.6}
                    />
                    <g className="v m-grin">
                      <path
                        d="M72.5 100.5 Q80 102 87.5 100.5 Q86.5 108.5 80 108.5 Q73.5 108.5 72.5 100.5Z"
                        fill={MOUTH}
                      />
                      <ellipse cx={80} cy={106.3} rx={3.4} ry={1.8} fill="var(--rose-500)" />
                    </g>
                    <path
                      className="v m-hmm"
                      d="M76.5 102.8 L84 101.6"
                      {...inkStroke}
                      strokeWidth={1.6}
                    />

                    {/* eyes */}
                    <Eyes cls="e-open" />
                    <Eyes r={6.6} hl={2.6} cls="e-wide" />
                    <Eyes dx={1.5} dy={-2.5} lids={false} cls="e-up" />
                    <g className="v e-happy" {...eyeStroke} strokeWidth={2.4}>
                      <path d="M56 84 Q62 77 68 84" />
                      <path d="M92 84 Q98 77 104 84" />
                    </g>
                    <g className="v e-closed" {...eyeStroke} strokeWidth={2.2}>
                      <path d="M56 82 Q62 86.5 68 82" />
                      <path d="M92 82 Q98 86.5 104 82" />
                    </g>
                    <g className="v e-half">
                      <circle cx={62} cy={83} r={5.4} fill={EYE} />
                      <circle cx={98} cy={83} r={5.4} fill={EYE} />
                      <circle cx={63.6} cy={84.6} r={1.4} fill="#fff" />
                      <circle cx={99.6} cy={84.6} r={1.4} fill="#fff" />
                      <path
                        d="M55.5 82 Q62 79.6 68.5 82 L68.5 75 L55.5 75Z M91.5 82 Q98 79.6 104.5 82 L104.5 75 L91.5 75Z"
                        fill={LID}
                      />
                      <path
                        d="M56 82 Q62 79.8 68 82 M92 82 Q98 79.8 104 82"
                        fill="none"
                        stroke={EYE}
                        strokeWidth={1.7}
                        strokeLinecap="round"
                      />
                    </g>

                    {/* brows */}
                    <g
                      className="v b-concern"
                      fill="none"
                      stroke="oklch(42% 0.07 44)"
                      strokeWidth={2.2}
                      strokeLinecap="round"
                    >
                      <path d="M55 74.5 L65 71" />
                      <path d="M105 74.5 L95 71" />
                    </g>
                    <g
                      className="v b-think"
                      fill="none"
                      stroke="oklch(42% 0.07 44)"
                      strokeWidth={2.2}
                      strokeLinecap="round"
                    >
                      <path d="M56 73 L66 72.5" />
                      <path d="M93 70.5 Q99 66.5 105 69.5" />
                    </g>
                  </g>
                </g>

                {/* mood extras */}
                <g
                  className="v x-zzz"
                  fill="var(--cloud-500)"
                  fontFamily="var(--font-serif)"
                  fontStyle="italic"
                  fontWeight={600}
                >
                  <text x={118} y={56} fontSize={10}>
                    z
                  </text>
                  <text x={125} y={46} fontSize={13}>
                    z
                  </text>
                  <text x={133} y={34} fontSize={16}>
                    z
                  </text>
                </g>
                <g
                  className="v x-dots"
                  fill="oklch(98% 0.01 250)"
                  stroke="var(--cloud-500)"
                  strokeWidth={1.3}
                >
                  <circle cx={120} cy={62} r={2.3} />
                  <circle cx={127.5} cy={52} r={3.3} />
                  <circle cx={137} cy={40} r={5} />
                </g>
                <g className="v x-sparkle" fill="var(--amber-500)">
                  <path d={star(40, 50, 5)} />
                  <path d={star(124, 42, 6)} />
                  <path d={star(132, 70, 4)} />
                </g>
              </g>
            </g>
          </g>
        </g>
      </g>

      {/* In front of the edge: contact shadows, arms, paws, mug */}
      <g className="mc-front">
        <ellipse cx={40} cy={145} rx={24} ry={5.5} fill={url('Shadow')} />
        <ellipse className="mc-shadow-r" cx={107} cy={145} rx={14} ry={5} fill={url('Shadow')} />

        {/* Left arm: resting (mug on the edge) and sipping (mug at mouth); gestures crossfade them */}
        <g className="mc-sip-rest">
          <g className="mc-cup">
            <Steam />
            <path
              d="M17 122 h-3 a6 6 0 0 0 0 12 h3"
              fill="none"
              stroke="oklch(95% 0.015 90)"
              strokeWidth={3.5}
            />
            <rect x={17} y={114} width={26} height={27} rx={6} fill="oklch(96% 0.015 90)" />
            <rect x={35} y={114} width={8} height={27} rx={4} fill="#000" opacity={0.07} />
            <rect x={17} y={125} width={26} height={6} fill="var(--sage-500)" />
            <ellipse cx={30} cy={115} rx={11.5} ry={2.3} fill="oklch(42% 0.06 50)" />
          </g>
          <path d="M46 110 C41 119 42 131 47 139 L59 139 C60.5 130 59 119 55 110 Z" fill={ARM} />
          <ellipse cx={53} cy={140.5} rx={9} ry={6.8} fill={PAW} />
          <path
            d="M49.5 136.5v3M53 136v3.5M56.5 136.5v3"
            stroke={PAW_LINE}
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        </g>
        <g className="mc-sip-pose">
          <path
            d="M49 122 Q53 113 64 109"
            fill="none"
            stroke={ARM}
            strokeWidth={11}
            strokeLinecap="round"
          />
          <g transform="rotate(-16 75 102)">
            <Steam small />
            <path
              d="M63 97 h-3 a5.5 5.5 0 0 0 0 11 h3"
              fill="none"
              stroke="oklch(95% 0.015 90)"
              strokeWidth={3.2}
            />
            <rect x={63} y={89} width={24} height={25} rx={5.5} fill="oklch(96% 0.015 90)" />
            <rect x={80} y={89} width={7} height={25} rx={3.5} fill="#000" opacity={0.07} />
            <rect x={63} y={99} width={24} height={5.5} fill="var(--sage-500)" />
            <ellipse cx={75} cy={89.8} rx={10.5} ry={2} fill="oklch(42% 0.06 50)" />
          </g>
          <ellipse cx={66} cy={110} rx={7.8} ry={6.6} fill={PAW} transform="rotate(-20 66 110)" />
          <path
            d="M62.5 107 l1.5 3M66 106 l.8 3.4M69.5 106.5 l0 3.2"
            stroke={PAW_LINE}
            strokeWidth={1.3}
            strokeLinecap="round"
          />
        </g>
        <g className="mc-arm-r">
          <path
            d="M105 110 C101 119 100 130 101 139 L113 139 C118 131 119 119 114 110 Z"
            fill={ARM}
          />
          <ellipse cx={107} cy={140.5} rx={9} ry={6.8} fill={PAW} />
          <path
            d="M103.5 136.5v3M107 136v3.5M110.5 136.5v3"
            stroke={PAW_LINE}
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        </g>
      </g>
    </svg>
  )
}
