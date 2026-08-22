// The 7-day off-court plan, linked from the home page's Off court card.
//
// Ported from the prototype in docs/TrainingPlan.jsx essentially unchanged: it
// was already built to this app's Tailwind and brand purple. The only additions
// are the back button's behaviour and this note — the prototype had no
// navigation of its own.

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

/* ============================================================
   TRAINING PLAN — off-court 7-day plan
   Single-file build, generated from the src/ modules.
   Edit src/ and regenerate; don't edit this file directly.
   ============================================================ */

/* ============================================================
   Exercise diagrams for the off-court training plan.

   One shared visual language across all 31 figures:
     slate         = the body
     dashed slate  = the start position / the "before"
     violet        = whatever the exercise actually depends on
                     (working muscle, alignment line, force direction)

   To add a figure: draw it on a 170 x 148 viewBox with the ground
   line around y=126, add it to FIGURES, then reference the key
   from `fig` in data/trainingPlan.js.
   ============================================================ */

const INK = "#334155";
const ACC = "#7C3AED";
const GRD = "#CBD5E1";
const FIL = "#EDE9FE";
const LBL = "#94A3B8";

const s = { fill: "none", stroke: INK, strokeWidth: 3.4, strokeLinecap: "round", strokeLinejoin: "round" };
const th = { fill: "none", stroke: INK, strokeWidth: 2.2, strokeLinecap: "round" };
const gr = { stroke: GRD, strokeWidth: 1.6 };
const ac = { fill: "none", stroke: ACC, strokeWidth: 3.4, strokeLinecap: "round", strokeLinejoin: "round" };
const ar = { fill: "none", stroke: ACC, strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round" };
const da = { fill: "none", stroke: ACC, strokeWidth: 1.8, strokeDasharray: "4 5", strokeLinecap: "round" };
const gh = { fill: "none", stroke: GRD, strokeWidth: 2.8, strokeDasharray: "5 5", strokeLinecap: "round", strokeLinejoin: "round" };
const bl = { fill: "#E2E8F0", stroke: GRD, strokeWidth: 1.4 };
const fl = { fill: FIL, stroke: ACC, strokeWidth: 1.6 };
const tx = { fontSize: 12, letterSpacing: ".06em", fill: LBL, fontWeight: 500 };
const ta = { fontSize: 12, letterSpacing: ".06em", fill: ACC, fontWeight: 600 };

const FIGURES = {
  splitSquat: (
    <>
      <line {...gr} x1="10" y1="128" x2="160" y2="128" />
      <rect {...bl} x="116" y="100" width="46" height="28" rx="2" />
      <path {...s} d="M126 100 L104 112" />
      <path {...s} d="M104 112 L88 76" />
      <path {...s} d="M88 76 L58 94" />
      <path {...s} d="M58 94 L56 128" />
      <line {...s} x1="44" y1="128" x2="68" y2="128" />
      <path {...s} d="M88 76 L86 44" />
      <circle {...s} cx="84" cy="33" r="8" />
      <path {...s} d="M86 44 L78 70" />
      <rect {...fl} x="70" y="70" width="16" height="7" rx="1.5" />
      <line {...da} x1="58" y1="92" x2="56" y2="130" />
      <text {...ta} x="6" y="112">SHIN</text>
      <text {...ta} x="6" y="124">VERTICAL</text>
    </>
  ),
  staticLunge: (
    <>
      <line {...gr} x1="8" y1="140" x2="162" y2="140" />
      <path {...s} d="M118 140 L114 108" />
      <line {...s} x1="106" y1="140" x2="130" y2="140" />
      <path {...s} d="M114 108 L82 96" />
      <path {...s} d="M82 96 L80 62" />
      <circle {...s} cx="78" cy="51" r="10" />
      <path {...s} d="M80 66 L66 92" />
      <path {...s} d="M82 96 L54 110" />
      <path {...s} d="M52 112 L54 136" />
      <line {...s} x1="44" y1="140" x2="62" y2="140" />
      <line {...da} x1="118" y1="106" x2="118" y2="142" />
      <path {...ar} d="M146 92 L146 118 M140 100 L146 92 L152 100 M140 110 L146 118 L152 110" />
      <text {...ta} x="124" y="84">DROP</text>
      <text {...ta} x="8" y="126">BACK KNEE</text>
      <text {...tx} x="10" y="158">BOTH FEET STAY PUT</text>
    </>
  ),
  hinge: (
    <>
      <line {...gr} x1="8" y1="120" x2="80" y2="120" />
      <line {...gr} x1="92" y1="120" x2="164" y2="120" />
      <line {...s} x1="30" y1="120" x2="52" y2="120" />
      <path {...s} d="M41 120 L43 94" />
      <path {...s} d="M43 94 L30 74" />
      <path {...s} d="M30 74 L56 62" />
      <circle {...s} cx="66" cy="55" r="7" />
      <path {...s} d="M56 62 L58 90" />
      <rect {...fl} x="50" y="90" width="15" height="6" rx="1.5" />
      <path {...ar} d="M28 66 L14 74 L28 82" />
      <text {...tx} x="12" y="138">HINGE</text>
      <g opacity=".4">
        <line {...s} x1="112" y1="120" x2="134" y2="120" />
        <path {...s} d="M122 120 L138 96" />
        <path {...s} d="M138 96 L120 80" />
        <path {...s} d="M120 80 L124 58" />
        <circle {...s} cx="126" cy="49" r="7" />
        <path {...s} d="M124 58 L146 64" />
        <rect {...fl} x="143" y="61" width="14" height="6" rx="1.5" />
      </g>
      <text {...tx} x="100" y="138">NOT SQUAT</text>
    </>
  ),
  copenhagen: (
    <>
      <line {...gr} x1="10" y1="122" x2="162" y2="122" />
      <rect {...bl} x="140" y="88" width="26" height="34" rx="2" />
      <line {...s} x1="16" y1="122" x2="46" y2="122" />
      <path {...s} d="M42 122 L48 90" />
      <circle {...s} cx="28" cy="88" r="8" />
      <path {...s} d="M48 90 L96 87" />
      <path {...ac} d="M96 87 L124 86 L152 86" />
      <path {...s} d="M96 87 L120 92 L136 95" />
      <line {...da} x1="136" y1="99" x2="136" y2="119" />
      <path {...da} d="M20 79 L158 76" />
      <path {...ar} d="M88 114 L88 98 M82 105 L88 98 L94 105" />
      <text {...ta} x="104" y="64">WORKING</text>
      <text {...tx} x="12" y="140">HOLD — DON&apos;T DIP</text>
    </>
  ),
  bandWalk: (
    <>
      <line {...gr} x1="8" y1="126" x2="162" y2="126" />
      <circle {...s} cx="84" cy="34" r="8" />
      <path {...s} d="M84 44 L84 78" />
      <path {...s} d="M68 54 L100 54" />
      <path {...s} d="M68 54 L58 76" />
      <path {...s} d="M100 54 L110 76" />
      <path {...s} d="M70 78 L98 78" />
      <path {...s} d="M72 78 L58 100 L54 126" />
      <path {...s} d="M96 78 L110 100 L114 126" />
      <line {...s} x1="44" y1="126" x2="64" y2="126" />
      <line {...s} x1="104" y1="126" x2="124" y2="126" />
      <path {...ac} d="M56 114 Q84 104 112 114" />
      <path {...ar} d="M132 138 L154 138 M147 132 L154 138 L147 144" />
      <text {...ta} x="58" y="98">TENSION</text>
    </>
  ),
  calfRaise: (
    <>
      {/* ---- Panel A: the set-up. Facing the rail, heels off the back edge ---- */}
      <line {...gr} x1="8" y1="134" x2="150" y2="134" />
      <rect {...bl} x="58" y="104" width="76" height="30" rx="2" />
      <line {...gr} x1="146" y1="16" x2="146" y2="134" />
      <path {...s} d="M44 114 L62 104 L88 104" />
      <path {...s} d="M64 102 L66 74" />
      <path {...s} d="M66 74 L62 50" />
      <path {...s} d="M62 50 L64 28" />
      <circle {...s} cx="66" cy="18" r="8" />
      <path {...s} d="M63 30 L142 44" />
      <path {...ar} d="M32 96 L32 124 M26 104 L32 96 L38 104 M26 116 L32 124 L38 116" />
      <text {...tx} x="8" y="150">STAND ON A STEP</text>
      <text {...ta} x="104" y="72">RAIL OR WALL</text>

      {/* ---- divider ---- */}
      <line stroke={GRD} strokeWidth="1.4" strokeDasharray="4 5" x1="164" y1="18" x2="164" y2="136" />

      {/* ---- Panel B: do it both ways ---- */}
      <rect {...bl} x="196" y="104" width="32" height="30" rx="2" />
      <path {...s} d="M182 114 L200 104 L220 104" />
      <path {...s} d="M202 102 L200 74" />
      <path {...s} d="M200 74 L202 52" />
      <text {...tx} x="176" y="150">STRAIGHT</text>

      <rect {...bl} x="264" y="104" width="32" height="30" rx="2" />
      <path {...s} d="M250 114 L268 104 L288 104" />
      <path {...s} d="M270 102 L278 76" />
      <path {...s} d="M278 76 L264 56" />
      <circle fill={ACC} cx="278" cy="76" r="4" />
      <text {...tx} x="258" y="150">BENT</text>
    </>
  ),
  couch: (
    <>
      <line {...gr} x1="10" y1="132" x2="150" y2="132" />
      <line {...gr} x1="150" y1="16" x2="150" y2="132" />
      <path {...ac} d="M146 132 L142 84" />
      <path {...s} d="M144 130 L96 108" />
      <path {...s} d="M96 108 L92 66" />
      <circle {...s} cx="90" cy="55" r="10" />
      <path {...s} d="M96 108 L56 116" />
      <path {...s} d="M56 116 L54 132" />
      <line {...s} x1="42" y1="132" x2="66" y2="132" />
      <path {...s} d="M92 68 L74 92" />
      <path {...da} d="M108 96 A 22 22 0 0 1 112 118" />
      <path {...ar} d="M105 112 L113 120 L118 110" />
      <text {...ta} x="46" y="42">TUCK TAILBONE</text>
      <text {...ta} x="112" y="72">SHIN UP</text>
      <text {...tx} x="10" y="150">KNEE IN THE CORNER</text>
    </>
  ),
  hipFlexor: (
    <>
      <line {...gr} x1="8" y1="136" x2="162" y2="136" />
      <path {...s} d="M124 136 L120 100" />
      <line {...s} x1="112" y1="136" x2="136" y2="136" />
      <path {...s} d="M120 100 L86 90" />
      <path {...s} d="M86 90 L84 54" />
      <circle {...s} cx="82" cy="43" r="10" />
      <path {...s} d="M84 58 L70 84" />
      <path {...ac} d="M86 90 L52 136" />
      <path {...s} d="M52 136 L28 132" />
      <path {...da} d="M100 78 A 20 20 0 0 1 104 98" />
      <path {...ar} d="M97 92 L105 100 L110 90" />
      <text {...ta} x="54" y="34">TUCK TAILBONE</text>
      <text {...ta} x="6" y="106">FRONT OF HIP</text>
      <text {...tx} x="10" y="154">BACK KNEE DOWN</text>
    </>
  ),
  ninety: (
    <>
      {/* ---- Panel A: side on — you are sat on the floor ---- */}
      <line {...gr} x1="10" y1="122" x2="140" y2="122" />
      <ellipse fill="#E2E8F0" cx="62" cy="117" rx="16" ry="5" />
      <path {...s} d="M56 114 L26 118" />
      <path {...s} d="M26 118 L16 111" />
      <path {...s} d="M68 114 L102 113" />
      <path {...s} d="M102 113 L112 120" />
      <path {...s} d="M62 112 L60 66" />
      <circle {...s} cx="58" cy="54" r="10" />
      <path {...s} d="M60 72 L84 98" />
      <path {...ar} d="M96 80 L96 50 M90 58 L96 50 L102 58" />
      <text {...ta} x="104" y="64">SIT</text>
      <text {...ta} x="104" y="78">TALL</text>
      <text {...tx} x="12" y="142">SIDE ON</text>

      {/* ---- divider ---- */}
      <line stroke={GRD} strokeWidth="1.4" strokeDasharray="4 5" x1="150" y1="18" x2="150" y2="132" />

      {/* ---- Panel B: the shape your legs make, seen from above ---- */}
      <ellipse fill="#E2E8F0" cx="230" cy="84" rx="19" ry="9" />
      <circle {...s} cx="230" cy="58" r="10" />
      <path {...s} d="M230 68 L230 80" />
      <path {...s} d="M218 80 L242 80" />
      <path {...s} d="M222 82 L190 62" />
      <path {...s} d="M190 62 L210 30" />
      <path {...ac} strokeWidth="3" d="M199.3 67.8 L205.1 58.5 L195.8 52.7" />
      <path {...s} d="M238 82 L274 92" />
      <path {...s} d="M274 92 L264 128" />
      <path {...ac} strokeWidth="3" d="M263.4 89.1 L260.5 99.7 L271.1 102.6" />
      <text {...ta} x="162" y="54">90°</text>
      <text {...ta} x="236" y="120">90°</text>
      <text {...tx} x="192" y="142">FROM ABOVE</text>
    </>
  ),
  invertedRow: (
    <>
      <line {...gr} x1="10" y1="130" x2="160" y2="130" />
      <line {...s} x1="30" y1="48" x2="110" y2="48" />
      <line {...th} x1="32" y1="48" x2="32" y2="130" />
      <path {...s} d="M60 88 L100 102 L140 116" />
      <circle {...s} cx="52" cy="86" r="8" />
      <path {...s} d="M140 116 L148 106" />
      <path {...s} d="M60 88 L52 68 L62 50" />
      <line {...da} x1="46" y1="82" x2="146" y2="114" />
      <path {...ar} d="M86 88 L80 64 M74 72 L80 64 L86 70" />
      <text {...tx} x="114" y="44">LOW BAR</text>
      <text {...tx} x="10" y="148">BODY STAYS STRAIGHT</text>
    </>
  ),
  bandPulldown: (
    <>
      <line {...gr} x1="10" y1="130" x2="150" y2="130" />
      <line {...gr} x1="140" y1="12" x2="140" y2="130" />
      <rect {...bl} x="134" y="14" width="12" height="12" rx="2" />
      <path {...ac} d="M137 24 L110 42" />
      <line {...s} x1="56" y1="126" x2="84" y2="126" />
      <path {...s} d="M56 126 L50 118" />
      <path {...s} d="M84 126 L86 102" />
      <path {...s} d="M86 102 L88 66" />
      <circle {...s} cx="90" cy="56" r="8" />
      <path {...s} d="M88 66 L104 56 L110 42" />
      <path {...ar} d="M124 50 L118 74 M112 66 L118 74 L124 70" />
      <text {...tx} x="92" y="14">ANCHOR</text>
      <text {...tx} x="10" y="148">TALL KNEELING</text>
    </>
  ),
  bandRow: (
    <>
      <line {...gr} x1="10" y1="140" x2="160" y2="140" />
      <line {...gr} x1="22" y1="20" x2="22" y2="140" />
      <rect {...bl} x="16" y="74" width="12" height="12" rx="2" />
      <path {...ac} d="M28 80 L86 84" />
      <circle {...s} cx="104" cy="42" r="10" />
      <path {...s} d="M104 52 L104 98" />
      <path {...s} d="M104 66 L92 82 L86 84" />
      <path {...gh} d="M104 66 L118 78" />
      <path {...s} d="M96 98 L114 98" />
      <path {...s} d="M98 98 L94 120 L92 140" />
      <path {...s} d="M112 98 L118 120 L120 140" />
      <line {...s} x1="82" y1="140" x2="100" y2="140" />
      <line {...s} x1="112" y1="140" x2="130" y2="140" />
      <path {...ar} d="M136 74 L152 90 M144 88 L152 90 L152 82" />
      <text {...tx} x="8" y="66">ANCHOR</text>
      <text {...ta} x="116" y="62">PULL BACK</text>
      <text {...tx} x="10" y="158">STAY SQUARE</text>
    </>
  ),
  kneelPulldown: (
    <>
      <line {...gr} x1="10" y1="130" x2="160" y2="130" />
      <line {...gr} x1="20" y1="10" x2="20" y2="130" />
      <rect {...bl} x="14" y="14" width="12" height="12" rx="2" />
      <path {...ac} d="M22 24 L58 50" />
      <line {...s} x1="96" y1="130" x2="126" y2="130" />
      <path {...s} d="M126 130 L132 123" />
      <path {...s} d="M96 130 L88 104" />
      <path {...s} d="M88 104 L62 108" />
      <path {...s} d="M62 108 L60 130" />
      <line {...s} x1="50" y1="130" x2="70" y2="130" />
      <path {...s} d="M88 104 L86 66" />
      <circle {...s} cx="84" cy="56" r="8" />
      <path {...s} d="M86 68 L74 54 L58 50" />
      <path {...s} d="M86 68 L96 92" />
      <path {...ar} d="M40 60 L52 84 M42 76 L52 84 L53 74" />
      <text {...tx} x="34" y="14">HIGH ANCHOR</text>
      <text {...tx} x="10" y="148">HALF KNEELING</text>
    </>
  ),
  row: (
    <>
      <line {...gr} x1="8" y1="130" x2="162" y2="130" />
      <rect {...bl} x="14" y="86" width="94" height="8" rx="2" />
      <line {...th} x1="24" y1="94" x2="24" y2="130" />
      <line {...th} x1="98" y1="94" x2="98" y2="130" />
      <path {...s} d="M28 86 L54 86" />
      <path {...s} d="M54 86 L84 70" />
      <path {...s} d="M84 70 L124 60" />
      <circle {...s} cx="136" cy="54" r="8" />
      <path {...s} d="M124 60 L106 86" />
      <path {...ac} d="M124 60 L128 82 L118 96" />
      <rect {...fl} x="108" y="94" width="16" height="7" rx="1.5" />
      <path {...s} d="M84 70 L90 104 L94 130" />
      <text {...ta} x="56" y="120">TO THE HIP</text>
    </>
  ),
  pullApart: (
    <>
      <circle {...s} cx="85" cy="34" r="8" />
      <path {...s} d="M66 56 L104 56" />
      <path {...s} d="M66 56 L30 56" />
      <path {...s} d="M104 56 L140 56" />
      <path {...ac} d="M30 56 Q85 76 140 56" />
      <path {...s} d="M85 56 L85 96" />
      <path {...s} d="M74 96 L96 96" />
      <path {...s} d="M76 96 L72 126" />
      <path {...s} d="M94 96 L98 126" />
      <line {...gr} x1="56" y1="126" x2="114" y2="126" />
      <path {...ar} d="M26 44 L14 44 M20 38 L14 44 L20 50" />
      <path {...ar} d="M144 44 L156 44 M150 38 L156 44 L150 50" />
      <text {...ta} x="50" y="92">TO CHEST</text>
    </>
  ),
  facePull: (
    <>
      <line {...gr} x1="8" y1="142" x2="162" y2="142" />
      <rect {...bl} x="142" y="34" width="14" height="14" rx="2" />
      <path {...ac} d="M142 41 L118 44" />
      <path {...ac} d="M118 44 L102 30" />
      <path {...ac} d="M118 44 L102 58" />
      <circle {...s} cx="58" cy="44" r="10" />
      <path {...s} d="M58 54 L58 100" />
      <path {...s} d="M42 62 L74 62" />
      <path {...s} d="M42 62 L56 28 L102 30" />
      <path {...s} d="M74 62 L80 50 L102 58" />
      <path {...s} d="M48 100 L70 100" />
      <path {...s} d="M50 100 L46 120 L44 142" />
      <path {...s} d="M68 100 L74 120 L76 142" />
      <line {...s} x1="34" y1="142" x2="54" y2="142" />
      <line {...s} x1="66" y1="142" x2="86" y2="142" />
      <path {...ar} d="M126 76 L104 76 M111 70 L104 76 L111 82" />
      <text {...ta} x="94" y="96">TO FACE</text>
      <text {...tx} x="10" y="158">ELBOWS HIGH, WIDE</text>
    </>
  ),
  ytw: (
    <>
      <line {...gr} x1="6" y1="106" x2="164" y2="106" />
      <circle {...s} strokeWidth="2.8" cx="28" cy="38" r="7" />
      <path {...s} strokeWidth="2.8" d="M18 54 L38 54" />
      <path {...s} strokeWidth="2.8" d="M18 54 L8 26" />
      <path {...s} strokeWidth="2.8" d="M38 54 L48 26" />
      <path {...s} strokeWidth="2.8" d="M28 54 L28 98" />
      <circle fill={ACC} cx="8" cy="26" r="4.5" />
      <circle fill={ACC} cx="48" cy="26" r="4.5" />
      <text {...ta} x="23" y="124">Y</text>

      <circle {...s} strokeWidth="2.8" cx="85" cy="38" r="7" />
      <path {...s} strokeWidth="2.8" d="M75 54 L95 54" />
      <path {...s} strokeWidth="2.8" d="M75 54 L56 48" />
      <path {...s} strokeWidth="2.8" d="M95 54 L114 48" />
      <path {...s} strokeWidth="2.8" d="M85 54 L85 98" />
      <circle fill={ACC} cx="56" cy="48" r="4.5" />
      <circle fill={ACC} cx="114" cy="48" r="4.5" />
      <text {...ta} x="81" y="124">T</text>

      <circle {...s} strokeWidth="2.8" cx="142" cy="38" r="7" />
      <path {...s} strokeWidth="2.8" d="M132 54 L152 54" />
      <path {...s} strokeWidth="2.8" d="M132 54 L118 66 L126 82" />
      <path {...s} strokeWidth="2.8" d="M152 54 L166 66 L158 82" />
      <path {...s} strokeWidth="2.8" d="M142 54 L142 98" />
      <circle fill={ACC} cx="126" cy="82" r="4.5" />
      <circle fill={ACC} cx="158" cy="82" r="4.5" />
      <text {...ta} x="137" y="124">W</text>

      <circle fill={ACC} cx="12" cy="142" r="4.5" />
      <text {...ta} x="23" y="146">THUMBS UP IN ALL 3</text>
    </>
  ),
  extRotation: (
    <>
      <rect {...bl} x="10" y="76" width="12" height="30" rx="2" />
      <line {...th} x1="22" y1="90" x2="120" y2="70" />
      <circle {...s} cx="66" cy="40" r="10" />
      <path {...s} d="M52 56 L82 56" />
      <path {...s} d="M82 56 L88 76" />
      <path {...ac} d="M88 76 L120 70" />
      <path {...gh} d="M88 76 L100 104" />
      <rect {...fl} x="82" y="70" width="12" height="12" rx="2" />
      <path {...da} d="M104 96 A26 26 0 0 0 116 76" />
      <path {...ar} d="M110 80 L117 73 L120 83" />
      <text {...ta} x="56" y="102">ELBOW</text>
      <text {...ta} x="56" y="114">PINNED</text>
      <text {...tx} x="8" y="132">FROM ABOVE</text>
    </>
  ),
  latStretch: (
    <>
      <line {...gr} x1="10" y1="136" x2="160" y2="136" />
      <rect {...bl} x="12" y="104" width="48" height="32" rx="2" />
      <path {...s} d="M46 104 L20 98" />
      <path {...s} d="M46 104 L72 96" />
      <circle {...s} cx="70" cy="114" r="8" />
      <path {...s} d="M72 96 L108 110" />
      <path {...s} d="M108 110 L110 136" />
      <line {...s} x1="110" y1="136" x2="138" y2="136" />
      <path {...s} d="M138 136 L144 129" />
      <path {...ar} d="M88 72 L88 94 M82 86 L88 94 L94 86" />
      <text {...ta} x="96" y="84">SINK</text>
      <text {...tx} x="10" y="152">ELBOWS ON A BENCH</text>
    </>
  ),
  tSpine: (
    <>
      <line {...gr} x1="8" y1="126" x2="162" y2="126" />
      <circle {...th} cx="90" cy="110" r="15" />
      <line {...th} x1="80" y1="100" x2="100" y2="120" />
      <path {...s} d="M42 122 Q76 102 112 94" />
      <circle {...s} cx="126" cy="86" r="8" />
      <path {...s} d="M112 94 L128 68 L118 82" />
      <path {...s} d="M42 122 L24 100 L18 126" />
      <path {...da} d="M108 74 A34 34 0 0 0 82 82" />
      <path {...ar} d="M84 74 L80 84 L90 87" />
      <text {...ta} x="26" y="66">EXTEND</text>
      <text {...tx} x="58" y="142">3–4 SPOTS</text>
    </>
  ),
  pecStretch: (
    <>
      {/* ---- Panel A: front on — where the arm goes ---- */}
      <line {...gr} x1="10" y1="140" x2="130" y2="140" />
      <line {...gr} x1="122" y1="14" x2="122" y2="140" />
      <circle {...s} cx="58" cy="34" r="10" />
      <path {...s} d="M42 62 L76 62" />
      <path {...s} d="M58 62 L58 100" />
      <path {...s} d="M48 100 L70 100" />
      <path {...s} d="M50 100 L44 140" />
      <path {...s} d="M68 100 L74 140" />
      <path {...s} d="M42 62 L32 92" />
      <path {...s} d="M76 62 L114 62" />
      <path {...ac} d="M114 62 L118 32" />
      <line {...da} x1="26" y1="62" x2="112" y2="62" />
      <text {...ta} x="6" y="58">SHOULDER HT</text>
      <text {...tx} x="10" y="154">FOREARM ON FRAME</text>

      {/* ---- divider ---- */}
      <line stroke={GRD} strokeWidth="1.4" strokeDasharray="4 5" x1="150" y1="18" x2="150" y2="138" />

      {/* ---- Panel B: from above — the rotation ---- */}
      <path {...s} d="M272 26 L272 64" />
      <path {...s} d="M272 112 L272 144" />
      <circle {...s} cx="202" cy="84" r="10" />
      <path {...s} d="M212 84 L222 84" />
      <path {...s} d="M222 64 L222 102" />
      <path {...s} d="M222 98 L256 92" />
      <path {...s} d="M256 92 L266 88" />
      <path {...ac} d="M266 88 L266 64" />
      <path {...s} d="M222 68 L200 58" />
      <path {...da} d="M250 44 A 44 44 0 0 0 190 48" />
      <path {...ar} d="M200 38 L188 48 L201 56" />
      <path {...ar} d="M214 128 L184 128 M192 122 L184 128 L192 134" />
      <text {...tx} x="156" y="22">FROM ABOVE</text>
      <text {...ta} x="234" y="62">TURN</text>
      <text {...ta} x="168" y="154">STEP THROUGH</text>
    </>
  ),
  chestOpener: (
    <>
      <rect {...bl} x="78" y="22" width="15" height="112" rx="7" />
      <circle {...s} cx="85" cy="36" r="10" />
      <path {...s} d="M85 46 L85 104" />
      <path {...s} d="M68 62 L102 62" />
      <path {...ac} d="M68 62 L26 68" />
      <path {...ac} d="M102 62 L144 68" />
      <circle fill={ACC} cx="26" cy="68" r="4.5" />
      <circle fill={ACC} cx="144" cy="68" r="4.5" />
      <path {...s} d="M78 104 L64 124 L70 140" />
      <path {...s} d="M92 104 L106 124 L100 140" />
      <path {...ar} d="M30 80 L20 90 M22 82 L20 90 L28 92" />
      <path {...ar} d="M140 80 L150 90 M148 82 L150 90 L142 92" />
      <text {...tx} x="98" y="20">ROLLER</text>
      <text {...ta} x="8" y="150">LET THE ARMS SINK</text>
    </>
  ),
  slRDL: (
    <>
      <line {...gr} x1="8" y1="140" x2="162" y2="140" />
      <path {...s} d="M62 140 L64 108" />
      <line {...s} x1="52" y1="140" x2="74" y2="140" />
      <path {...s} d="M64 108 L74 84" />
      <path {...s} d="M74 84 L112 76" />
      <circle {...s} cx="124" cy="72" r="9" />
      <path {...s} d="M74 84 L38 100 L14 116" />
      <path {...s} d="M104 78 L100 108" />
      <rect {...fl} x="90" y="108" width="20" height="8" rx="2" />
      <line {...da} x1="70" y1="86" x2="20" y2="112" />
      <path {...ar} d="M50 60 L28 74 M30 62 L28 74 L40 76" />
      <text {...ta} x="46" y="50">BACK LEG LONG</text>
      <text {...tx} x="10" y="156">ONE LEG</text>
    </>
  ),
  sideLyingER: (
    <>
      <line {...gr} x1="8" y1="132" x2="162" y2="132" />
      <path {...s} d="M40 122 L108 118" />
      <circle {...s} cx="28" cy="116" r="9" />
      <path {...s} d="M108 118 L138 130" />
      <path {...s} d="M66 118 L70 96" />
      <path {...ac} d="M70 96 L104 92" />
      <path {...gh} d="M70 96 L96 112" />
      <rect {...fl} x="100" y="86" width="18" height="9" rx="2" />
      <path {...da} d="M84 108 A 20 20 0 0 0 90 96" />
      <path {...ar} d="M86 98 L94 92 L96 102" />
      <text {...ta} x="72" y="72">ROTATE UP</text>
      <text {...tx} x="10" y="150">ELBOW PINNED</text>
    </>
  ),
  bandOhPress: (
    <>
      <line {...gr} x1="8" y1="142" x2="162" y2="142" />
      <line {...s} x1="34" y1="142" x2="70" y2="142" />
      <path {...s} d="M70 142 L78 114" />
      <path {...s} d="M78 114 L108 118" />
      <path {...s} d="M108 118 L110 142" />
      <line {...s} x1="100" y1="142" x2="122" y2="142" />
      <path {...s} d="M78 114 L80 74" />
      <circle {...s} cx="80" cy="63" r="9" />
      <path {...s} d="M80 76 L100 62 L108 34" />
      <path {...ac} d="M108 34 L86 96 L62 142" />
      <path {...ar} d="M130 62 L130 34 M124 42 L130 34 L136 42" />
      <text {...ta} x="120" y="82">PRESS</text>
      <text {...tx} x="10" y="158">BAND UNDER FOOT</text>
    </>
  ),
  pullThrough: (
    <>
      <line {...gr} x1="8" y1="140" x2="162" y2="140" />
      <rect {...bl} x="8" y="126" width="16" height="14" rx="2" />
      <path {...ac} d="M20 133 L78 122" />
      <path {...s} d="M86 140 L88 106" />
      <line {...s} x1="76" y1="140" x2="98" y2="140" />
      <path {...s} d="M88 106 L114 88" />
      <path {...s} d="M114 88 L144 92" />
      <circle {...s} cx="154" cy="90" r="9" />
      <path {...s} d="M114 88 L96 106" />
      <path {...s} d="M96 106 L78 122" />
      <path {...da} d="M108 62 A 32 32 0 0 0 132 78" />
      <path {...ar} d="M100 70 L110 58 L118 70" />
      <text {...ta} x="58" y="50">HIPS SNAP</text>
      <text {...tx} x="10" y="156">BAND BETWEEN LEGS</text>
    </>
  ),
  deepSquat: (
    <>
      <line {...gr} x1="8" y1="126" x2="162" y2="126" />
      <line {...s} x1="48" y1="126" x2="76" y2="126" />
      <path {...s} d="M58 126 L92 96" />
      <path {...s} d="M92 96 L54 104" />
      <path {...s} d="M54 104 L64 60" />
      <circle {...s} cx="66" cy="49" r="8" />
      <path {...s} d="M64 60 L98 72" />
      <rect {...fl} x="96" y="68" width="14" height="12" rx="2" />
      <path {...ac} strokeWidth="4" d="M46 126 L58 126" />
      <text {...ta} x="4" y="112">HEELS</text>
      <text {...ta} x="4" y="124">DOWN</text>
      <text {...tx} x="98" y="96">COUNTER</text>
    </>
  ),
  wgs: (
    <>
      <line {...gr} x1="8" y1="128" x2="162" y2="128" />
      <line {...s} x1="88" y1="128" x2="112" y2="128" />
      <path {...s} d="M96 128 L94 92" />
      <path {...s} d="M94 92 L58 98" />
      <path {...s} d="M58 98 L28 120 L14 128" />
      <path {...s} d="M58 98 L62 64" />
      <circle {...s} cx="66" cy="53" r="8" />
      <path {...s} d="M62 64 L76 94 L82 128" />
      <path {...ac} d="M62 64 L78 26" />
      <path {...da} d="M96 34 A30 30 0 0 0 76 20" />
      <path {...ar} d="M92 26 L97 36 L86 38" />
      <text {...ta} x="98" y="58">EYES</text>
      <text {...ta} x="98" y="70">FOLLOW</text>
    </>
  ),
  needle: (
    <>
      <line {...gr} x1="8" y1="126" x2="162" y2="126" />
      <path {...s} d="M52 88 L112 90" />
      <path {...s} d="M112 90 L116 126" />
      <line {...s} x1="106" y1="126" x2="126" y2="126" />
      <path {...s} d="M52 88 L44 126" />
      <circle {...s} cx="34" cy="82" r="8" />
      <path {...ac} d="M52 88 L66 110 L94 116" />
      <path {...da} d="M84 108 Q88 60 56 42" />
      <path {...ar} d="M66 42 L56 42 L60 52" />
      <text {...ta} x="92" y="106">UNDER</text>
      <text {...ta} x="18" y="34">THEN OPEN</text>
    </>
  ),
  pigeon: (
    <>
      <circle {...s} cx="78" cy="34" r="10" />
      <path {...s} d="M78 44 L78 68" />
      <path {...s} d="M66 68 L92 68" />
      <path {...s} d="M68 68 L44 70" />
      <path {...ac} d="M44 70 L98 88" />
      <path {...s} d="M90 68 L100 98" />
      <path {...s} d="M100 98 L108 132" />
      <line {...da} x1="52" y1="68" x2="110" y2="68" />
      <text {...ta} x="112" y="64">HIPS</text>
      <text {...ta} x="112" y="76">SQUARE</text>
      <text {...tx} x="10" y="120">FROM ABOVE</text>
    </>
  ),
  floss: (
    <>
      <line {...gr} x1="8" y1="118" x2="162" y2="118" />
      <circle {...s} cx="26" cy="100" r="8" />
      <path {...s} d="M40 110 L86 112" />
      <path {...s} d="M86 112 L136 116" />
      <path {...s} d="M86 112 L98 68" />
      <path {...ac} d="M98 68 L104 36" />
      <path {...ac} d="M104 36 L120 30" />
      <path {...gh} d="M86 112 L114 82 L128 56" />
      <path {...ar} d="M118 52 L128 46 M122 40 L128 46 L122 52" />
      <text {...ta} x="112" y="78">STRAIGHTEN</text>
      <text {...ta} x="112" y="90">AS YOU FLEX</text>
    </>
  ),
  ankle: (
    <>
      <line {...gr} x1="8" y1="126" x2="140" y2="126" />
      <line {...gr} x1="140" y1="16" x2="140" y2="126" />
      <line {...s} x1="70" y1="126" x2="112" y2="126" />
      <path {...s} d="M78 124 L114 88" />
      <path {...s} d="M114 88 L96 50" />
      <path {...s} d="M96 50 L94 26" />
      <path {...s} d="M96 40 L136 48" />
      <path {...da} d="M114 88 L138 84" />
      <path {...ar} d="M114 138 L138 138 M120 132 L114 138 L120 144 M132 132 L138 138 L132 144" />
      <path {...ac} strokeWidth="4" d="M68 126 L80 126" />
      <text {...ta} x="10" y="112">HEEL</text>
      <text {...ta} x="10" y="124">DOWN</text>
      <text {...tx} x="92" y="76">KNEE TO WALL</text>
    </>
  ),
  pogo: (
    <>
      <line {...gr} x1="8" y1="126" x2="162" y2="126" />
      <circle {...s} cx="85" cy="34" r="8" />
      <path {...s} d="M85 44 L85 76" />
      <path {...s} d="M70 54 L100 54" />
      <path {...s} d="M70 54 L60 70 L68 82" />
      <path {...s} d="M100 54 L110 70 L102 82" />
      <path {...s} d="M74 76 L96 76" />
      <path {...s} d="M76 76 L74 106" />
      <path {...s} d="M94 76 L96 106" />
      <line {...s} x1="68" y1="106" x2="80" y2="106" />
      <line {...s} x1="90" y1="106" x2="102" y2="106" />
      <path {...da} d="M74 112 L74 124" />
      <path {...da} d="M96 112 L96 124" />
      <path {...ar} d="M126 106 L126 84 M120 91 L126 84 L132 91" />
      <text {...ta} x="8" y="100">STIFF</text>
      <text {...ta} x="8" y="112">ANKLES</text>
      <text {...tx} x="54" y="142">QUIET</text>
    </>
  ),
  bound: (
    <>
      <line {...gr} x1="8" y1="132" x2="162" y2="132" />
      <circle {...gh} cx="34" cy="58" r="8" />
      <path {...gh} d="M34 66 L34 96" />
      <path {...gh} d="M22 74 L46 74" />
      <path {...gh} d="M34 96 L28 132" />
      <path {...gh} d="M34 96 L46 116" />
      <path {...da} d="M46 118 Q86 52 118 128" />
      <circle {...s} cx="122" cy="46" r="9" />
      <path {...s} d="M122 55 L122 88" />
      <path {...s} d="M106 66 L138 66" />
      <path {...s} d="M106 66 L92 78 L82 66" />
      <path {...s} d="M138 66 L152 78 L162 64" />
      <path {...s} d="M110 88 L134 88" />
      <path {...s} d="M112 88 L110 110 L108 132" />
      <path {...s} d="M132 88 L146 106 L152 118" />
      <line {...da} x1="110" y1="108" x2="108" y2="134" />
      <text {...tx} x="8" y="144">PUSH OFF</text>
      <text {...ta} x="108" y="144">STICK 2s</text>
    </>
  ),
  skater: (
    <>
      <line {...gr} x1="8" y1="132" x2="162" y2="132" />
      <circle {...gh} cx="26" cy="72" r="7" />
      <path {...gh} d="M26 79 L26 104" />
      <path {...gh} d="M26 104 L20 132" />
      <circle {...gh} cx="146" cy="72" r="7" />
      <path {...gh} d="M146 79 L146 104" />
      <path {...gh} d="M146 104 L152 132" />
      <circle {...s} cx="85" cy="34" r="8" />
      <path {...s} d="M85 44 L85 76" />
      <path {...s} d="M70 54 L100 54" />
      <path {...s} d="M70 54 L54 62" />
      <path {...s} d="M100 54 L116 62" />
      <path {...s} d="M76 76 L64 100" />
      <path {...s} d="M94 76 L112 96 L100 108" />
      <path {...da} d="M32 116 Q85 96 138 116" />
      <path {...ar} d="M42 108 L32 116 L44 122" />
      <path {...ar} d="M128 108 L138 116 L126 122" />
      <text {...ta} x="50" y="146">NO PAUSE</text>
    </>
  ),
  medBall: (
    <>
      {/* ---- Panel A: wound back ---- */}
      <line {...gr} x1="8" y1="140" x2="130" y2="140" />
      <line {...gr} x1="120" y1="16" x2="120" y2="140" />
      <circle {...s} cx="58" cy="34" r="10" />
      <path {...s} d="M58 44 L58 96" />
      <path {...s} d="M42 58 L74 58" />
      <path {...s} d="M42 58 L26 46" />
      <path {...s} d="M74 58 L34 42" />
      <circle {...fl} cx="26" cy="40" r="10" />
      <path {...s} d="M48 96 L70 96" />
      <path {...s} d="M50 96 L44 118 L42 140" />
      <path {...s} d="M68 96 L76 118 L78 140" />
      <line {...s} x1="32" y1="140" x2="52" y2="140" />
      <line {...s} x1="70" y1="140" x2="90" y2="140" />
      <path {...da} d="M42 112 A 26 26 0 0 0 74 116" />
      <path {...ar} d="M64 112 L76 118 L66 124" />
      <text {...ta} x="6" y="134">WIND BACK</text>
      <text {...tx} x="96" y="30">WALL</text>

      <line stroke={GRD} strokeWidth="1.4" strokeDasharray="4 5" x1="148" y1="18" x2="148" y2="142" />

      {/* ---- Panel B: released ---- */}
      <line {...gr} x1="164" y1="140" x2="292" y2="140" />
      <line {...gr} x1="284" y1="16" x2="284" y2="140" />
      <circle {...s} cx="204" cy="34" r="10" />
      <path {...s} d="M204 44 L204 96" />
      <path {...s} d="M188 58 L220 58" />
      <path {...s} d="M188 58 L228 52" />
      <path {...s} d="M220 58 L240 50" />
      <path {...gh} d="M188 58 L172 46" />
      <circle {...fl} cx="268" cy="44" r="10" />
      <path {...da} d="M248 48 L258 46" />
      <path {...s} d="M194 96 L216 96" />
      <path {...s} d="M196 96 L190 118 L188 140" />
      <path {...s} d="M214 96 L222 118 L224 140" />
      <line {...s} x1="178" y1="140" x2="198" y2="140" />
      <line {...s} x1="216" y1="140" x2="236" y2="140" />
      <path {...ar} d="M196 116 L216 112 M209 106 L216 112 L210 119" />
      <text {...ta} x="180" y="134">HIPS LEAD</text>
      <text {...tx} x="238" y="76">THROW</text>
    </>
  ),
  bandChop: (
    <>
      {/* ---- Panel A: wound back ---- */}
      <line {...gr} x1="8" y1="140" x2="130" y2="140" />
      <rect {...bl} x="8" y="46" width="13" height="28" rx="2" />
      <path {...ac} d="M21 60 L38 54" />
      <circle {...s} cx="60" cy="34" r="10" />
      <path {...s} d="M60 44 L60 96" />
      <path {...s} d="M44 58 L76 58" />
      <path {...s} d="M44 58 L38 54" />
      <path {...s} d="M76 58 L42 50" />
      <path {...s} d="M50 96 L72 96" />
      <path {...s} d="M52 96 L46 118 L44 140" />
      <path {...s} d="M70 96 L78 118 L80 140" />
      <line {...s} x1="34" y1="140" x2="54" y2="140" />
      <line {...s} x1="72" y1="140" x2="92" y2="140" />
      <path {...da} d="M44 112 A 26 26 0 0 0 76 116" />
      <path {...ar} d="M66 112 L78 118 L68 124" />
      <text {...ta} x="6" y="134">WIND BACK</text>
      <text {...tx} x="86" y="30">ANCHOR</text>

      <line stroke={GRD} strokeWidth="1.4" strokeDasharray="4 5" x1="148" y1="18" x2="148" y2="142" />

      {/* ---- Panel B: rotated through ---- */}
      <line {...gr} x1="164" y1="140" x2="292" y2="140" />
      <rect {...bl} x="164" y="46" width="13" height="28" rx="2" />
      <path {...ac} d="M177 60 L244 66" />
      <circle {...s} cx="212" cy="34" r="10" />
      <path {...s} d="M212 44 L212 96" />
      <path {...s} d="M196 58 L228 58" />
      <path {...s} d="M196 58 L238 62" />
      <path {...s} d="M228 58 L244 64" />
      <path {...gh} d="M196 58 L190 52" />
      <path {...s} d="M202 96 L224 96" />
      <path {...s} d="M204 96 L198 118 L196 140" />
      <path {...s} d="M222 96 L230 118 L232 140" />
      <line {...s} x1="186" y1="140" x2="206" y2="140" />
      <line {...s} x1="224" y1="140" x2="244" y2="140" />
      <path {...ar} d="M204 116 L226 112 M219 106 L226 112 L220 119" />
      <text {...ta} x="186" y="134">HIPS LEAD</text>
      <text {...tx} x="238" y="92">CONTROL</text>
    </>
  ),
  pallof: (
    <>
      {/* ---- Panel A: hands at the chest ---- */}
      <line {...gr} x1="8" y1="140" x2="132" y2="140" />
      <rect {...bl} x="8" y="58" width="13" height="30" rx="2" />
      <path {...ac} d="M21 72 L56 80" />
      <circle {...s} cx="78" cy="34" r="10" />
      <path {...s} d="M78 44 L78 96" />
      <path {...s} d="M60 58 L96 58" />
      <path {...s} d="M60 58 L54 82" />
      <path {...s} d="M96 58 L102 82" />
      <path {...s} d="M54 82 L70 88" />
      <path {...s} d="M102 82 L86 88" />
      <rect {...fl} x="62" y="74" width="16" height="11" rx="2" />
      <path {...s} d="M68 96 L90 96" />
      <path {...s} d="M70 96 L62 118 L60 140" />
      <path {...s} d="M88 96 L96 118 L98 140" />
      <line {...s} x1="50" y1="140" x2="70" y2="140" />
      <line {...s} x1="90" y1="140" x2="110" y2="140" />
      <path {...ar} d="M42 106 L24 106 M31 100 L24 106 L31 112" />
      <text {...ta} x="8" y="124">BAND PULLS</text>
      <text {...tx} x="14" y="156">HANDS AT CHEST</text>

      <line stroke={GRD} strokeWidth="1.4" strokeDasharray="4 5" x1="150" y1="18" x2="150" y2="142" />

      {/* ---- Panel B: pressed out ---- */}
      <line {...gr} x1="166" y1="140" x2="292" y2="140" />
      <rect {...bl} x="166" y="58" width="13" height="30" rx="2" />
      <path {...ac} d="M179 72 L198 78" />
      <circle {...s} cx="240" cy="34" r="10" />
      <path {...s} d="M240 44 L240 96" />
      <path {...s} d="M222 58 L258 58" />
      <path {...s} d="M222 58 L204 78" />
      <path {...s} d="M258 58 L214 82" />
      <path {...gh} d="M222 60 L216 84" />
      <rect {...fl} x="196" y="72" width="16" height="11" rx="2" />
      <path {...s} d="M230 96 L252 96" />
      <path {...s} d="M232 96 L224 118 L222 140" />
      <path {...s} d="M250 96 L258 118 L260 140" />
      <line {...s} x1="212" y1="140" x2="232" y2="140" />
      <line {...s} x1="252" y1="140" x2="272" y2="140" />
      <path {...ar} d="M268 106 L288 106 M281 100 L288 106 L281 112" />
      <text {...ta} x="230" y="124">PRESS OUT</text>
      <text {...tx} x="176" y="156">STAY SQUARE</text>
    </>
  ),
  deadBug: (
    <>
      <line {...gr} x1="8" y1="122" x2="162" y2="122" />
      <circle {...s} cx="28" cy="104" r="8" />
      <path {...s} d="M42 114 L92 116" />
      <path {...s} d="M46 112 L44 70" />
      <path {...gh} d="M44 112 L22 86" />
      <path {...s} d="M92 116 L96 76" />
      <path {...s} d="M96 76 L124 74" />
      <path {...gh} d="M92 116 L120 96 L148 100" />
      <path {...ac} strokeWidth="4" d="M50 120 L88 121" />
      <text {...ta} x="40" y="140">LOW BACK PRESSED</text>
    </>
  ),
  pushUp: (
    <>
      <line {...gr} x1="8" y1="126" x2="162" y2="126" />
      <path {...s} d="M54 84 L100 96 L142 108" />
      <circle {...s} cx="42" cy="78" r="8" />
      <path {...s} d="M54 84 L70 108 L54 126" />
      <path {...s} d="M142 108 L148 126" />
      <line {...da} x1="46" y1="80" x2="150" y2="112" />
      <path {...ac} strokeWidth="2.6" d="M76 108 L88 100" />
      <text {...ta} x="68" y="70">ONE LINE</text>
      <text {...tx} x="86" y="140">ELBOWS 45°</text>
    </>
  ),
  dbBench: (
    <>
      <line {...gr} x1="8" y1="140" x2="162" y2="140" />
      <rect {...bl} x="26" y="98" width="96" height="9" rx="2" />
      <line {...th} x1="36" y1="107" x2="36" y2="140" />
      <line {...th} x1="112" y1="107" x2="112" y2="140" />
      <path {...s} d="M40 98 L100 98" />
      <circle {...s} cx="34" cy="90" r="9" />
      <path {...s} d="M100 98 L116 120" />
      <path {...s} d="M116 120 L136 140" />
      <path {...s} d="M56 96 L50 68" />
      <path {...s} d="M72 96 L78 68" />
      <rect {...fl} x="40" y="60" width="20" height="8" rx="2" />
      <rect {...fl} x="68" y="60" width="20" height="8" rx="2" />
      <path {...ar} d="M100 76 L100 52 M94 60 L100 52 L106 60" />
      <path {...da} d="M92 80 L130 80" />
      <text {...ta} x="106" y="70">PRESS</text>
      <text {...tx} x="10" y="156">FEET FLAT ON FLOOR</text>
    </>
  ),
  hkPress: (
    <>
      <line {...gr} x1="8" y1="130" x2="162" y2="130" />
      <line {...s} x1="46" y1="130" x2="86" y2="130" />
      <path {...s} d="M86 130 L96 100" />
      <path {...s} d="M96 100 L128 104" />
      <path {...s} d="M128 104 L130 130" />
      <line {...s} x1="120" y1="130" x2="142" y2="130" />
      <path {...s} d="M96 100 L99 64" />
      <circle {...s} cx="103" cy="54" r="8" />
      <path {...s} d="M99 64 L116 54 L112 28" />
      <rect {...fl} x="100" y="20" width="24" height="8" rx="2" />
      <path {...s} d="M99 64 L82 88" />
      <line {...da} x1="111" y1="32" x2="96" y2="130" />
      <path {...da} d="M84 112 A18 18 0 0 0 92 126" />
      <text {...ta} x="6" y="110">GLUTE ON</text>
      <text {...ta} x="126" y="76">STACKED</text>
    </>
  ),
  landmine: (
    <>
      <line {...gr} x1="8" y1="140" x2="162" y2="140" />
      <rect {...bl} x="10" y="128" width="22" height="12" rx="2" />
      <line {...s} x1="22" y1="132" x2="96" y2="66" />
      <circle {...s} cx="128" cy="48" r="10" />
      <path {...s} d="M128 58 L126 98" />
      <path {...s} d="M114 70 L140 70" />
      <path {...s} d="M114 70 L96 66" />
      <path {...gh} d="M114 72 L106 92" />
      <path {...s} d="M118 98 L136 98" />
      <path {...s} d="M120 98 L114 120 L112 140" />
      <path {...s} d="M134 98 L142 120 L144 140" />
      <line {...s} x1="102" y1="140" x2="122" y2="140" />
      <line {...s} x1="136" y1="140" x2="156" y2="140" />
      <path {...ar} d="M78 76 L60 58 M60 68 L60 58 L70 58" />
      <text {...ta} x="50" y="98">UP AND AWAY</text>
      <text {...tx} x="10" y="156">BAR END IN A CORNER</text>
    </>
  ),
  inclinePress: (
    <>
      <line {...gr} x1="8" y1="140" x2="162" y2="140" />
      <path {...bl} d="M34 140 L34 100 L104 62 L104 140 Z" />
      <path {...s} d="M46 122 L92 78" />
      <circle {...s} cx="100" cy="66" r="9" />
      <path {...s} d="M46 122 L38 140" />
      <path {...s} d="M46 122 L64 138" />
      <path {...s} d="M78 92 L74 56" />
      <path {...s} d="M88 82 L98 48" />
      <rect {...fl} x="68" y="40" width="36" height="9" rx="2" />
      <path {...ar} d="M128 92 L128 62 M122 70 L128 62 L134 70" />
      <path {...da} d="M120 96 L146 96" />
      <text {...ta} x="118" y="114">PRESS</text>
      <text {...tx} x="10" y="156">BENCH AT ~45°</text>
    </>
  ),
  carryHold: (
    <>
      <line {...gr} x1="8" y1="142" x2="162" y2="142" />
      <circle {...s} cx="78" cy="30" r="10" />
      <path {...s} d="M78 40 L78 96" />
      <path {...s} d="M62 54 L94 54" />
      <path {...s} d="M62 54 L56 92" />
      <path {...s} d="M94 54 L100 92" />
      <rect {...fl} x="93" y="92" width="15" height="22" rx="2" />
      <path {...s} d="M68 96 L88 96" />
      <path {...s} d="M70 96 L64 120 L62 142" />
      <path {...s} d="M86 96 L92 120 L94 142" />
      <line {...s} x1="52" y1="142" x2="72" y2="142" />
      <line {...s} x1="84" y1="142" x2="104" y2="142" />
      <line {...da} x1="44" y1="54" x2="122" y2="54" />
      <path {...ar} d="M34 84 L34 108 M28 92 L34 84 L40 92 M28 100 L34 108 L40 100" />
      <text {...ta} x="8" y="46">LEVEL</text>
      <text {...ta} x="112" y="132">HEAVY</text>
      <text {...tx} x="10" y="158">STAND STILL, HOLD</text>
    </>
  ),
  wallSlide: (
    <>
      {/* ---- Panel A: side on — forearm lies flat on the wall ---- */}
      <line {...gr} x1="8" y1="140" x2="122" y2="140" />
      <line {...gr} x1="122" y1="12" x2="122" y2="140" />
      <circle {...s} cx="66" cy="42" r="10" />
      <path {...s} d="M66 52 L70 98" />
      <path {...s} d="M70 64 L120 66" />
      <path {...ac} d="M121 68 L121 26" />
      <path {...s} d="M62 98 L80 98" />
      <path {...s} d="M64 98 L60 120 L58 140" />
      <path {...s} d="M78 98 L84 120 L86 140" />
      <line {...s} x1="48" y1="140" x2="66" y2="140" />
      <line {...s} x1="76" y1="140" x2="94" y2="140" />
      <path {...ar} d="M42 74 L42 52 M36 60 L42 52 L48 60" />
      <text {...ta} x="6" y="100">FLAT ON</text>
      <text {...ta} x="6" y="112">THE WALL</text>
      <text {...tx} x="10" y="156">SIDE ON</text>

      <line stroke={GRD} strokeWidth="1.4" strokeDasharray="4 5" x1="146" y1="16" x2="146" y2="142" />

      {/* ---- Panel B: front on — slide up and reach ---- */}
      <line {...gr} x1="166" y1="140" x2="292" y2="140" />
      <circle {...s} cx="228" cy="46" r="10" />
      <path {...s} d="M228 56 L228 100" />
      <path {...s} d="M212 68 L244 68" />
      <path {...s} d="M212 68 L206 50" />
      <path {...s} d="M244 68 L250 50" />
      <path {...ac} d="M206 50 L204 22" />
      <path {...ac} d="M250 50 L252 22" />
      <path {...gh} d="M212 70 L200 84" />
      <path {...gh} d="M244 70 L256 84" />
      <path {...s} d="M218 100 L238 100" />
      <path {...s} d="M220 100 L216 120 L214 140" />
      <path {...s} d="M236 100 L240 120 L242 140" />
      <line {...s} x1="204" y1="140" x2="222" y2="140" />
      <line {...s} x1="234" y1="140" x2="252" y2="140" />
      <path {...ar} d="M274 78 L274 40 M268 48 L274 40 L280 48" />
      <text {...ta} x="248" y="96">SLIDE</text>
      <text {...tx} x="170" y="156">FRONT ON</text>
    </>
  ),
  carry: (
    <>
      <line {...gr} x1="8" y1="132" x2="162" y2="132" />
      <circle {...s} cx="78" cy="34" r="8" />
      <path {...s} d="M64 54 L94 54" />
      <path {...s} d="M78 54 L78 92" />
      <path {...s} d="M68 92 L90 92" />
      <path {...s} d="M69 92 L64 132" />
      <path {...s} d="M89 92 L94 132" />
      <path {...s} d="M64 54 L58 88" />
      <path {...s} d="M94 54 L100 90" />
      <rect {...fl} x="94" y="90" width="14" height="20" rx="2" />
      <line {...da} x1="46" y1="54" x2="120" y2="54" />
      <text {...ta} x="12" y="46">LEVEL</text>
      <text {...tx} x="104" y="128">HEAVY</text>
    </>
  ),
  sidePlank: (
    <>
      <line {...gr} x1="8" y1="124" x2="162" y2="124" />
      <line {...s} x1="22" y1="124" x2="48" y2="124" />
      <path {...s} d="M36 124 L42 98" />
      <circle {...s} cx="28" cy="90" r="8" />
      <path {...s} d="M42 98 L92 106 L138 118" />
      <path {...ac} d="M42 98 L46 60" />
      <line {...s} x1="132" y1="124" x2="146" y2="124" />
      <line {...da} x1="34" y1="94" x2="142" y2="120" />
      <text {...ta} x="52" y="88">PUSH FLOOR AWAY</text>
    </>
  ),
  goblet: (
    <>
      <line {...gr} x1="8" y1="128" x2="162" y2="128" />
      <circle {...s} cx="85" cy="30" r="8" />
      <path {...s} d="M70 50 L100 50" />
      <path {...s} d="M70 50 L74 68" />
      <path {...s} d="M100 50 L96 68" />
      <rect {...fl} x="76" y="62" width="18" height="16" rx="3" />
      <path {...s} d="M85 50 L85 86" />
      <path {...s} d="M70 86 L100 86" />
      <path {...s} d="M72 86 L56 102 L60 128" />
      <path {...s} d="M98 86 L114 102 L110 128" />
      <line {...s} x1="50" y1="128" x2="70" y2="128" />
      <line {...s} x1="100" y1="128" x2="120" y2="128" />
      <path {...da} d="M74 68 L60 100" />
      <path {...da} d="M96 68 L110 100" />
      <text {...ta} x="4" y="66">ELBOWS</text>
      <text {...ta} x="4" y="78">INSIDE</text>
    </>
  ),
  swing: (
    <>
      <line {...gr} x1="8" y1="130" x2="162" y2="130" />
      <circle {...gh} cx="102" cy="66" r="7" />
      <path {...gh} d="M92 74 L58 84" />
      <path {...gh} d="M58 84 L74 104 L78 130" />
      <path {...gh} d="M92 74 L96 106" />
      <circle {...gh} cx="98" cy="112" r="7" />
      <path {...s} d="M82 130 L82 100" />
      <path {...s} d="M82 100 L80 76" />
      <path {...s} d="M80 76 L82 44" />
      <circle {...s} cx="84" cy="34" r="8" />
      <line {...s} x1="70" y1="130" x2="94" y2="130" />
      <path {...s} d="M82 44 L114 60" />
      <circle {...fl} cx="120" cy="63" r="10" />
      <path {...da} d="M104 108 Q124 92 122 76" />
      <path {...ar} d="M115 82 L122 72 L128 82" />
      <text {...ta} x="6" y="60">HIPS SNAP</text>
      <text {...tx} x="8" y="120">HINGE</text>
    </>
  ),
  plank: (
    <>
      <line {...gr} x1="8" y1="124" x2="162" y2="124" />
      <line {...s} x1="26" y1="124" x2="56" y2="124" />
      <path {...s} d="M34 124 L38 98" />
      <circle {...s} cx="24" cy="92" r="8" />
      <path {...s} d="M38 98 L90 106 L138 116" />
      <path {...s} d="M138 116 L144 124" />
      <line {...da} x1="30" y1="96" x2="146" y2="120" />
      <path {...ac} strokeWidth="2.6" d="M92 100 L102 98" />
      <text {...ta} x="54" y="88">GLUTES ON</text>
    </>
  ),
};

/* ============================================================
   ANIMATED VARIANTS

   A handful of exercises hinge on something a still drawing
   can't show — a path, a tempo, or a thing that deliberately
   does NOT move. Those get an animated variant here, keyed by
   the same name as the static figure.

   Everything else stays static on purpose. Animation is only
   worth it where the motion carries the meaning.

   Poses must keep limb lengths equal across keyframes or the
   figure visibly stretches mid-rep.
   ============================================================ */

function An({ attr, values, keyTimes, dur }) {
  return (
    <animate
      attributeName={attr}
      values={values}
      keyTimes={keyTimes}
      dur={dur}
      repeatCount="indefinite"
    />
  );
}

const K5 = "0; 0.42; 0.54; 0.94; 1";
const KT = "0; 0.35; 0.55; 0.8; 1";
const KW = "0; 0.25; 0.5; 0.75; 1";
const KF = "0; 0.15; 0.45; 0.85; 1";
const KX = "0; 0.30; 0.38; 0.80; 0.88; 1";

const ANIMATED = {
  /* ---- Med ball throw: hips lead, arms follow, ball goes ---- */
  medBall: (
    <>
      <line {...gr} x1="8" y1="140" x2="150" y2="140" />
      <line {...gr} x1="150" y1="16" x2="150" y2="140" />
      <text {...tx} x="120" y="30">WALL</text>
      <path {...s} d="M50 96 L44 118 L42 140" />
      <path {...s} d="M68 96 L76 118 L78 140" />
      <path {...s} d="M49 134 L57 140 L68 140" />
      <line {...s} x1="70" y1="140" x2="90" y2="140" />
      <g>
        <path {...s} d="M48 96 L70 96" />
        <animateTransform attributeName="transform" type="rotate"
          values="0 59 96; -6 59 96; 10 59 96; 10 59 96; 0 59 96"
          keyTimes={KT} dur="2.6s" repeatCount="indefinite" />
      </g>
      <path {...s} d="M59 44 L59 96" />
      <circle {...s} cx="59" cy="34" r="10" />
      <path {...s} d="M43 58 L75 58" />
      <path {...s} d="M43 58 L24 54">
        <An attr="d" dur="2.6s" keyTimes={KT}
          values="M43 58 L24 54; M43 58 L20 56; M43 58 L84 56; M43 58 L88 58; M43 58 L24 54" />
      </path>
      <path {...s} d="M75 58 L32 50">
        <An attr="d" dur="2.6s" keyTimes={KT}
          values="M75 58 L32 50; M75 58 L28 52; M75 58 L92 52; M75 58 L96 54; M75 58 L32 50" />
      </path>
      <circle {...fl} cx="24" cy="50" r="10">
        <An attr="cx" dur="2.6s" keyTimes="0; 0.35; 0.55; 0.72; 1" values="24; 20; 94; 146; 24" />
        <An attr="cy" dur="2.6s" keyTimes="0; 0.35; 0.55; 0.72; 1" values="50; 52; 54; 58; 50" />
        <An attr="opacity" dur="2.6s" keyTimes="0; 0.35; 0.62; 0.74; 0.9; 1" values="1; 1; 1; 0; 0; 1" />
      </circle>
      <text {...ta} x="8" y="26">HIPS FIRST</text>
      <text {...tx} x="8" y="154">FEET STAY PLANTED</text>
    </>
  ),

  /* ---- Split squat: front shin stays put, everything above travels ---- */
  splitSquat: (
    <>
      <line {...gr} x1="10" y1="128" x2="160" y2="128" />
      <rect {...bl} x="116" y="100" width="46" height="28" rx="2" />
      <line {...da} x1="46" y1="92" x2="46" y2="130" />
      <path {...s} d="M106 90 L126 100">
        <An attr="d" dur="3.4s" keyTimes={K5}
          values="M106 90 L126 100; M104 112 L126 100; M104 112 L126 100; M106 90 L126 100; M106 90 L126 100" />
      </path>
      <path {...s} d="M76 64 L106 90">
        <An attr="d" dur="3.4s" keyTimes={K5}
          values="M76 64 L106 90; M88 76 L104 112; M88 76 L104 112; M76 64 L106 90; M76 64 L106 90" />
      </path>
      <path {...s} d="M64 96 L76 64">
        <An attr="d" dur="3.4s" keyTimes={K5}
          values="M64 96 L76 64; M58 94 L88 76; M58 94 L88 76; M64 96 L76 64; M64 96 L76 64" />
      </path>
      <path {...s} d="M56 128 L64 96">
        <An attr="d" dur="3.4s" keyTimes={K5}
          values="M56 128 L64 96; M56 128 L58 94; M56 128 L58 94; M56 128 L64 96; M56 128 L64 96" />
      </path>
      <line {...s} x1="44" y1="128" x2="68" y2="128" />
      <path {...s} d="M76 64 L74 32">
        <An attr="d" dur="3.4s" keyTimes={K5}
          values="M76 64 L74 32; M88 76 L86 44; M88 76 L86 44; M76 64 L74 32; M76 64 L74 32" />
      </path>
      <circle {...s} cx="72" cy="21" r="8">
        <An attr="cx" dur="3.4s" keyTimes={K5} values="72; 84; 84; 72; 72" />
        <An attr="cy" dur="3.4s" keyTimes={K5} values="21; 33; 33; 21; 21" />
      </circle>
      <path {...s} d="M74 32 L66 58">
        <An attr="d" dur="3.4s" keyTimes={K5}
          values="M74 32 L66 58; M86 44 L78 70; M86 44 L78 70; M74 32 L66 58; M74 32 L66 58" />
      </path>
      <rect {...fl} x="58" y="58" width="16" height="7" rx="1.5">
        <An attr="x" dur="3.4s" keyTimes={K5} values="58; 70; 70; 58; 58" />
        <An attr="y" dur="3.4s" keyTimes={K5} values="58; 70; 70; 58; 58" />
      </rect>
      <text {...ta} x="6" y="28">SHIN STAYS</text>
      <text {...ta} x="6" y="40">VERTICAL</text>
      <text {...tx} x="8" y="146">BACK FOOT STAYS PUT</text>
    </>
  ),

  /* ---- Static lunge: both feet planted for the whole rep ---- */
  staticLunge: (
    <>
      <line {...gr} x1="8" y1="140" x2="162" y2="140" />
      <line {...s} x1="104" y1="140" x2="124" y2="140" />
      <path {...s} d="M49 134 L57 140 L68 140" />
      <line {...da} x1="132" y1="84" x2="132" y2="126" />
      <path {...ar} d="M126 92 L132 84 L138 92 M126 118 L132 126 L138 118" />
      <path {...s} d="M56 114 L49 134">
        <An attr="d" dur="3.4s" keyTimes={K5}
          values="M56 114 L49 134; M70 132 L49 134; M70 132 L49 134; M56 114 L49 134; M56 114 L49 134" />
      </path>
      <path {...s} d="M75 90 L56 114">
        <An attr="d" dur="3.4s" keyTimes={K5}
          values="M75 90 L56 114; M80 102 L70 132; M80 102 L70 132; M75 90 L56 114; M75 90 L56 114" />
      </path>
      <path {...s} d="M75 90 L94 114">
        <An attr="d" dur="3.4s" keyTimes={K5}
          values="M75 90 L94 114; M80 102 L110 110; M80 102 L110 110; M75 90 L94 114; M75 90 L94 114" />
      </path>
      <path {...s} d="M94 114 L110 140">
        <An attr="d" dur="3.4s" keyTimes={K5}
          values="M94 114 L110 140; M110 110 L110 140; M110 110 L110 140; M94 114 L110 140; M94 114 L110 140" />
      </path>
      <path {...s} d="M75 90 L73 56">
        <An attr="d" dur="3.4s" keyTimes={K5}
          values="M75 90 L73 56; M80 102 L78 68; M80 102 L78 68; M75 90 L73 56; M75 90 L73 56" />
      </path>
      <circle {...s} cx="71" cy="45" r="10">
        <An attr="cx" dur="3.4s" keyTimes={K5} values="71; 76; 76; 71; 71" />
        <An attr="cy" dur="3.4s" keyTimes={K5} values="45; 57; 57; 45; 45" />
      </circle>
      <path {...s} d="M74 64 L69 88">
        <An attr="d" dur="3.4s" keyTimes={K5}
          values="M74 64 L69 88; M79 76 L74 100; M79 76 L74 100; M74 64 L69 88; M74 64 L69 88" />
      </path>
      <path {...s} d="M74 64 L80 87">
        <An attr="d" dur="3.4s" keyTimes={K5}
          values="M74 64 L80 87; M79 76 L85 99; M79 76 L85 99; M74 64 L80 87; M74 64 L80 87" />
      </path>
      <text {...ta} x="6" y="28">STRAIGHT DOWN,</text>
      <text {...ta} x="6" y="40">NOT FORWARDS</text>
      <text {...tx} x="8" y="154">BOTH FEET STAY PUT</text>
      <text {...tx} x="8" y="168">UP ON THE BACK TOES</text>
    </>
  ),
};

/* ---- Hinge vs squat: the whole point is the difference in path ---- */
ANIMATED.hinge = (
  <>
    <line {...gr} x1="8" y1="132" x2="138" y2="132" />
    <line {...s} x1="40" y1="132" x2="62" y2="132" />
    <path {...s} d="M50 132 L52 104">
      <An attr="d" dur="3.4s" keyTimes={K5}
        values="M50 132 L52 104; M50 132 L54 104; M50 132 L54 104; M50 132 L52 104; M50 132 L52 104" />
    </path>
    <path {...s} d="M52 104 L54 74">
      <An attr="d" dur="3.4s" keyTimes={K5}
        values="M52 104 L54 74; M54 104 L32 84; M54 104 L32 84; M52 104 L54 74; M52 104 L54 74" />
    </path>
    <path {...s} d="M54 74 L56 40">
      <An attr="d" dur="3.4s" keyTimes={K5}
        values="M54 74 L56 40; M32 84 L66 80; M32 84 L66 80; M54 74 L56 40; M54 74 L56 40" />
    </path>
    <circle {...s} cx="56" cy="29" r="9">
      <An attr="cx" dur="3.4s" keyTimes={K5} values="56; 76; 76; 56; 56" />
      <An attr="cy" dur="3.4s" keyTimes={K5} values="29; 76; 76; 29; 29" />
    </circle>
    <path {...s} d="M56 46 L58 72">
      <An attr="d" dur="3.4s" keyTimes={K5}
        values="M56 46 L58 72; M64 81 L66 109; M64 81 L66 109; M56 46 L58 72; M56 46 L58 72" />
    </path>
    <rect {...fl} x="50" y="70" width="16" height="7" rx="1.5">
      <An attr="x" dur="3.4s" keyTimes={K5} values="50; 58; 58; 50; 50" />
      <An attr="y" dur="3.4s" keyTimes={K5} values="70; 107; 107; 70; 70" />
    </rect>
    <path {...ar} d="M44 100 L22 100 M30 94 L22 100 L30 106" />
    <text {...ta} x="6" y="118">HIPS</text>
    <text {...ta} x="6" y="130">BACK</text>
    <text {...tx} x="8" y="152">HINGE — DO THIS</text>

    <line stroke={GRD} strokeWidth="1.4" strokeDasharray="4 5" x1="150" y1="18" x2="150" y2="146" />

    <line {...gr} x1="164" y1="132" x2="292" y2="132" />
    <g opacity="0.45">
      <line {...s} x1="190" y1="132" x2="212" y2="132" />
      <path {...s} d="M200 132 L202 104">
        <An attr="d" dur="3.4s" keyTimes={K5}
          values="M200 132 L202 104; M200 132 L214 108; M200 132 L214 108; M200 132 L202 104; M200 132 L202 104" />
      </path>
      <path {...s} d="M202 104 L204 74">
        <An attr="d" dur="3.4s" keyTimes={K5}
          values="M202 104 L204 74; M214 108 L186 102; M214 108 L186 102; M202 104 L204 74; M202 104 L204 74" />
      </path>
      <path {...s} d="M204 74 L206 40">
        <An attr="d" dur="3.4s" keyTimes={K5}
          values="M204 74 L206 40; M186 102 L198 70; M186 102 L198 70; M204 74 L206 40; M204 74 L206 40" />
      </path>
      <circle {...s} cx="206" cy="29" r="9">
        <An attr="cx" dur="3.4s" keyTimes={K5} values="206; 200; 200; 206; 206" />
        <An attr="cy" dur="3.4s" keyTimes={K5} values="29; 59; 59; 29; 29" />
      </circle>
      <path {...s} d="M206 46 L208 72">
        <An attr="d" dur="3.4s" keyTimes={K5}
          values="M206 46 L208 72; M196 74 L198 102; M196 74 L198 102; M206 46 L208 72; M206 46 L208 72" />
      </path>
    </g>
    <path {...ar} d="M252 76 L252 104 M246 96 L252 104 L258 96" />
    <text {...ta} x="240" y="56">HIPS</text>
    <text {...ta} x="240" y="68">DOWN</text>
    <text {...tx} x="166" y="152">SQUAT — NOT THIS</text>
  </>
);

/* ---- Lateral band walk: the band never goes slack ---- */
ANIMATED.bandWalk = (
  <>
    <line {...gr} x1="8" y1="132" x2="182" y2="132" />
    <path {...s} d="M74 88 L71 110 L68 132">
      <An attr="d" dur="3.2s" keyTimes={KW}
        values="M74 88 L71 110 L68 132; M84 88 L71 110 L68 132; M94 88 L91 110 L88 132; M84 88 L71 110 L68 132; M74 88 L71 110 L68 132" />
    </path>
    <path {...s} d="M96 88 L99 110 L102 132">
      <An attr="d" dur="3.2s" keyTimes={KW}
        values="M96 88 L99 110 L102 132; M106 88 L119 110 L122 132; M116 88 L119 110 L122 132; M106 88 L119 110 L122 132; M96 88 L99 110 L102 132" />
    </path>
    <line {...s} x1="60" y1="132" x2="76" y2="132">
      <An attr="x1" dur="3.2s" keyTimes={KW} values="60; 60; 80; 60; 60" />
      <An attr="x2" dur="3.2s" keyTimes={KW} values="76; 76; 96; 76; 76" />
    </line>
    <line {...s} x1="94" y1="132" x2="110" y2="132">
      <An attr="x1" dur="3.2s" keyTimes={KW} values="94; 114; 114; 114; 94" />
      <An attr="x2" dur="3.2s" keyTimes={KW} values="110; 130; 130; 130; 110" />
    </line>
    <line {...ac} x1="68" y1="123" x2="102" y2="123">
      <An attr="x1" dur="3.2s" keyTimes={KW} values="68; 68; 88; 68; 68" />
      <An attr="x2" dur="3.2s" keyTimes={KW} values="102; 122; 122; 122; 102" />
    </line>
    <path {...s} d="M74 88 L96 88">
      <An attr="d" dur="3.2s" keyTimes={KW}
        values="M74 88 L96 88; M84 88 L106 88; M94 88 L116 88; M84 88 L106 88; M74 88 L96 88" />
    </path>
    <path {...s} d="M85 52 L85 88">
      <An attr="d" dur="3.2s" keyTimes={KW}
        values="M85 52 L85 88; M95 52 L95 88; M105 52 L105 88; M95 52 L95 88; M85 52 L85 88" />
    </path>
    <path {...s} d="M70 62 L100 62">
      <An attr="d" dur="3.2s" keyTimes={KW}
        values="M70 62 L100 62; M80 62 L110 62; M90 62 L120 62; M80 62 L110 62; M70 62 L100 62" />
    </path>
    <path {...s} d="M70 62 L64 90">
      <An attr="d" dur="3.2s" keyTimes={KW}
        values="M70 62 L64 90; M80 62 L74 90; M90 62 L84 90; M80 62 L74 90; M70 62 L64 90" />
    </path>
    <path {...s} d="M100 62 L106 90">
      <An attr="d" dur="3.2s" keyTimes={KW}
        values="M100 62 L106 90; M110 62 L116 90; M120 62 L126 90; M110 62 L116 90; M100 62 L106 90" />
    </path>
    <circle {...s} cx="85" cy="42" r="10">
      <An attr="cx" dur="3.2s" keyTimes={KW} values="85; 95; 105; 95; 85" />
    </circle>
    <text {...ta} x="6" y="18">TOES POINT FORWARD</text>
    <text {...ta} x="6" y="150">BAND NEVER GOES SLACK</text>
  </>
);

/* ---- Hip flexor: only the pelvis moves, and that IS the exercise ---- */
ANIMATED.hipFlexor = (
  <>
    <line {...gr} x1="8" y1="136" x2="182" y2="136" />
    <line {...s} x1="112" y1="136" x2="136" y2="136" />
    <path {...s} d="M124 136 L120 100" />
    <path {...s} d="M52 136 L28 132" />
    <path {...s} d="M120 100 L90 92">
      <An attr="d" dur="4s" keyTimes={KF}
        values="M120 100 L90 92; M120 100 L90 92; M120 100 L83 95; M120 100 L83 95; M120 100 L90 92" />
    </path>
    <path {...s} d="M90 92 L52 136">
      <An attr="d" dur="4s" keyTimes={KF}
        values="M90 92 L52 136; M90 92 L52 136; M83 95 L52 136; M83 95 L52 136; M90 92 L52 136" />
    </path>
    <path {...s} d="M90 92 C 101 78, 90 62, 85 52">
      <An attr="d" dur="4s" keyTimes={KF}
        values="M90 92 C 101 78, 90 62, 85 52; M90 92 C 101 78, 90 62, 85 52; M83 95 C 79 80, 84 66, 85 52; M83 95 C 79 80, 84 66, 85 52; M90 92 C 101 78, 90 62, 85 52" />
    </path>
    <circle {...s} cx="83" cy="41" r="10" />
    <path {...s} d="M85 56 L71 82" />
    <path {...ar} d="M68 112 A 13 13 0 0 1 79 103 M73 99 L79 103 L75 110" />
    <text {...ta} x="6" y="128">TUCK</text>
    <path {...ac} d="M92 106 A 16 16 0 0 1 102 95" opacity="0">
      <An attr="opacity" dur="4s" keyTimes={KX} values="0; 0; 1; 1; 0; 0" />
    </path>
    <text {...ta} x="108" y="86" opacity="0">
      FELT HERE
      <An attr="opacity" dur="4s" keyTimes={KX} values="0; 0; 1; 1; 0; 0" />
    </text>
    <text {...tx} x="8" y="156" opacity="1">
      ARCHED — NO STRETCH
      <An attr="opacity" dur="4s" keyTimes={KX} values="1; 1; 0; 0; 1; 1" />
    </text>
    <text {...ta} x="8" y="156" opacity="0">
      TUCKED — STRETCH
      <An attr="opacity" dur="4s" keyTimes={KX} values="0; 0; 1; 1; 0; 0" />
    </text>
  </>
);

const VIEWBOX_ANIM = {
  medBall: "0 0 170 158",
  splitSquat: "0 0 170 150",
  staticLunge: "0 0 170 180",
  hinge: "0 0 300 156",
  bandWalk: "0 0 190 154",
  hipFlexor: "0 0 190 160",
};

/* Most figures sit on a 170 x 148 grid. A few need a wider frame
   because they show two views side by side. */
const VIEWBOX = {
  ninety: "0 0 300 150",
  calfRaise: "0 0 300 156",
  invertedRow: "0 0 170 154",
  bandPulldown: "0 0 170 154",
  bandRow: "0 0 170 162",
  kneelPulldown: "0 0 170 154",
  ytw: "0 0 170 152",
  chestOpener: "0 0 170 156",
  latStretch: "0 0 170 156",
  pecStretch: "0 0 300 160",
  pallof: "0 0 300 162",
  medBall: "0 0 300 148",
  bandChop: "0 0 300 148",
  inclinePress: "0 0 170 160",
  carryHold: "0 0 170 162",
  dbBench: "0 0 170 160",
  facePull: "0 0 170 162",
  landmine: "0 0 170 160",
  wallSlide: "0 0 300 160",
  slRDL: "0 0 170 160",
  sideLyingER: "0 0 170 154",
  bandOhPress: "0 0 170 162",
  pullThrough: "0 0 170 160",
  staticLunge: "0 0 170 162",
  couch: "0 0 170 156",
  hipFlexor: "0 0 170 160",
};

/* Respect the OS-level reduced-motion setting: fall back to the static figure. */
function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduce(mq.matches);
    sync();
    mq.addEventListener ? mq.addEventListener("change", sync) : mq.addListener(sync);
    return () =>
      mq.removeEventListener ? mq.removeEventListener("change", sync) : mq.removeListener(sync);
  }, []);
  return reduce;
}

function Figure({ name, className = "", animate = false }) {
  const reduce = usePrefersReducedMotion();
  const moving = animate && !reduce && !!ANIMATED[name];
  const box = moving
    ? VIEWBOX_ANIM[name] || VIEWBOX[name] || "0 0 170 148"
    : VIEWBOX[name] || "0 0 170 148";

  return (
    <svg viewBox={box} className={className} role="img" aria-hidden="true">
      {moving ? ANIMATED[name] : FIGURES[name]}
    </svg>
  );
}

/* ============================================================
   Content for the off-court training plan.

   No JSX here on purpose - this file is safe to edit without
   touching the screen. `fig` keys map into FIGURES in
   components/training/figures.jsx.
   ============================================================ */

const LOAD_MAX = 4;

const KIT_LABEL = { none: "Bodyweight", band: "Band", weights: "Weights" };

const DAYS = [
  {
    n: 1,
    short: "Lower",
    title: "Lower strength",
    sub: "Lower body strength + hip mobility",
    time: "≈40 min",
    load: 4,
    focus:
      "The single-leg strength that survives a third set. Every point is one leg loading while the other recovers — so train it that way.",
    exercises: [
      { name: "Split squat", kit: "none",
        options: [
          { name: "Static lunge", fig: "staticLunge", dose: "3 × 10 / leg",
            body: "Step one foot forward into a long stride and leave both feet planted for the whole set — no stepping in and out between reps. Drop straight down until the back knee almost touches the floor and the front thigh is roughly parallel to it, then drive back up through the front heel. Both feet on the ground makes this the more stable of the two, so start here if the elevated version feels wobbly, and add dumbbells once ten clean reps are easy.",
            cue: "Travel straight down, not forwards. The front shin stays close to vertical and the back knee tracks towards the floor rather than the front foot." },
          { name: "Rear foot elevated", fig: "splitSquat", dose: "3 × 8 / leg",
            body: "Stand a full stride in front of a bench and lay the top of your rear foot on it. Almost all the weight sits on the front leg — the back leg is a kickstand, nothing more. Lower until the front thigh is roughly parallel with the floor, then drive up through the front heel.",
            cue: "Front shin stays close to vertical. If the knee is diving forward, your stride is too short." },
        ] },
      { name: "Hip hinge", kit: "weights",
        options: [
          { name: "Romanian deadlift", fig: "hinge", dose: "3 × 8",
            body: "Push your hips backwards and let the weight slide down the front of your thighs, staying in contact the whole way. Knees stay softly bent but the angle never changes. Stop when the hamstrings load up, then drive the hips forwards.",
            cue: "Test it against a wall: push the hips back until they touch without bending the knees further. That travel is the movement." },
          { name: "Single-leg RDL", fig: "slRDL", dose: "3 × 8 / leg",
            body: "Same hinge on one leg, and no weight needed to start. Stand on one leg, push the hips back and let the free leg travel straight out behind you as a counterweight until your torso and back leg form one line roughly parallel to the floor. Hold a dumbbell or a loaded bag in the opposite hand once bodyweight feels easy.",
            cue: "Keep the hips level — the free-leg hip wants to rotate open towards the ceiling. Point the back toes at the floor to stop it. The balance demand more than makes up for the lighter load." },
        ] },
      { fig: "copenhagen", name: "Copenhagen plank", dose: "2 × 20s / side", kit: "none",
        body: "The best insurance against a groin strain, and almost nobody does it. Lie on your side with the top leg on a bench, sofa, armchair seat or low wall — anything stable at roughly knee height — then lift your hips until ear, shoulder, hip and that supported ankle sit in one straight line. It's a hold, not a movement — the hips stay up and still for the full twenty seconds. Lift the bottom leg too and keep it roughly parallel just under the top one, touching neither the floor nor the bench.",
        cue: "Move the bench from under the knee → mid-shin → ankle as you get stronger. Lowering and lifting the hip is a harder variation — earn the still hold first." },
      { fig: "bandWalk", name: "Lateral band walks", dose: "3 × 12 each way", kit: "band",
        body: "Band around the ankles or above the knees, drop into a quarter squat, step sideways keeping constant tension. The feet never fully come together.",
        cue: "Toes point straight ahead. The moment they flare out, the glute medius has handed the job to something else." },
      { fig: "calfRaise", name: "Calf raises — straight & bent knee", dose: "2 × 15 each", kit: "none",
        body: "Stand on the edge of a step with the balls of your feet on it and your heels hanging off into space, fingertips on a wall or rail for balance. Let the heels sink well below the step, then press up as high as you can. Straight-knee raises load the gastrocnemius; bending the knee about twenty degrees shifts the work to the soleus — the muscle that absorbs repeated split-steps. Do both, straight first. No step to hand? Flat ground works, you just lose the stretch at the bottom.",
        cue: "Three seconds down. The lowering is where the tendon adapts." },
      { name: "Hip flexor stretch", kit: "none",
        options: [
          { name: "Half-kneeling", fig: "hipFlexor", dose: "2 × 45s / side",
            body: "Kneel on one knee with the other foot planted forward, both knees at roughly a right angle — the same position as a half-kneeling press. Squeeze the glute of the down leg and tuck your tailbone under, so your lower back flattens rather than arches. You should feel it across the front of the hip on the kneeling side. Only once that fades, slide the front foot a little further forward.",
            cue: "The tuck is the entire stretch. If you feel nothing, you are almost certainly arching your lower back instead of tucking — put a hand on your belt buckle and tilt it up towards your chin. Cushion under the knee if the floor is hard." },
          { name: "Couch stretch", fig: "couch", dose: "2 × 45s / side",
            body: "The harder version, and worth building up to rather than starting with. Kneel with your back to a wall and slide the rear shin up it so the whole shin is vertical against the wall and that knee sits in the corner where wall meets floor. Front foot planted well forward. Squeeze the rear glute and tuck your tailbone underneath you — that tuck is the stretch.",
            cue: "Too intense? Move the front foot further forward before you move away from the wall." },
        ] },
      { fig: "ninety", name: "90/90 hip switch", dose: "8 slow reps", kit: "none",
        body: "Sit on the floor. One leg in front with the knee bent to a right angle and the shin across your body; the other out to the side, knee also at a right angle, shin running away behind you. Then sweep both legs across to the mirror image — exactly like a windscreen wiper, which is what a lot of coaches call it. A hand on the floor for balance is fine; sitting back on it isn't.",
        cue: "Sit tall and go slowly. The travel between the two sides is where the mobility gets built — don't just flop through the middle." },
    ],
  },
  {
    n: 2,
    short: "Pull",
    kitLabel: "Full gym",
    title: "Upper pull",
    sub: "Upper pull + shoulder health",
    time: "≈35 min",
    load: 3,
    focus:
      "Serving is a pushing action repeated thousands of times a week. This day builds the back that keeps that shoulder intact.",
    exercises: [
      { name: "Vertical pull", kit: "weights",
        options: [
          { name: "Kneeling pulldown", fig: "kneelPulldown", dose: "3 × 10 / side",
            body: "Anchor a cable or band high — a lat pulldown station, or the top rail of court fencing. Kneel side-on to it in a half-kneeling position with the pulling arm on the same side as the down knee. Pull the handle down and in towards your ribs, leading with the shoulder blade rather than the elbow, then return slowly and let the arm reach fully overhead at the top.",
            cue: "Squeeze the rear glute so your lower back doesn't arch as the arm goes overhead. One side at a time also stops your stronger side quietly doing the work." },
          { name: "Inverted row", fig: "invertedRow", dose: "3 × 8–12",
            body: "A loaded bodyweight pull that needs nothing but something to lie under. Find any waist-height horizontal bar — a low fence rail, a picnic table edge, the underside of a sturdy railing. Lie beneath it, body dead straight from head to heels, and pull your chest up to the bar.",
            cue: "Feet further out or up on a bench makes it harder; knees bent with feet under you makes it easier. Adjust the angle rather than the rep count." },
        ] },
      { name: "Single-arm row", kit: "weights",
        options: [
          { name: "Dumbbell row", fig: "row", dose: "3 × 10 / side",
            body: "One hand and knee on a bench, opposite foot planted. Row towards your hip rather than your armpit, and let it travel down and slightly forwards at the bottom so the shoulder blade actually moves.",
            cue: "Ribcage square to the floor. If your torso twists to help the weight up, drop a size." },
          { name: "Band row", fig: "bandRow", dose: "3 × 12 / side",
            body: "Anchor a band at waist height on court fencing, a fence post or a door, and step back until there is tension with your arm straight. Row the handle to your hip, letting the shoulder blade travel with it, then return slowly with the arm reaching forward at the end.",
            cue: "Stay square to the anchor. If your torso rotates to help the handle back, step in and lose some tension." },
        ] },
      { name: "Rear shoulder work", kit: "band",
        options: [
          { name: "Band pull-apart", fig: "pullApart", dose: "3 × 15",
            body: "Arms straight out in front at shoulder height holding a band at roughly shoulder width. Pull your hands apart until the band touches your chest, squeezing the shoulder blades together, then return slowly against the tension rather than letting it snap back.",
            cue: "The travel version — works anywhere with one band. No band? Hold a towel taut and pull outwards against it for five seconds a rep; isometric, but it reaches the same muscles." },
          { name: "Cable face pull", fig: "facePull", dose: "3 × 15",
            body: "With a rope on a cable at roughly face height, pull towards your face and finish with your hands wider than your elbows and your knuckles pointing behind you. Elbows stay high, level with your shoulders, rather than dropping towards your ribs.",
            cue: "The better of the two if you have the cable, because you can load it properly and the external rotation at the finish is worth having. Deliberately light and high-rep either way — this is maintenance, not a lift to progress." },
        ] },
      { fig: "ytw", name: "Prone Y–T–W", dose: "2 × 8 each shape", kit: "none",
        body: "Three separate exercises done back to back, not one flowing movement — finish all the reps of one shape before changing to the next, resetting your arms on the floor in between. Lie face down with your forehead resting on the floor and your thumbs pointing at the ceiling the whole time. Y: arms overhead in a narrow V. T: arms straight out to the sides. W: elbows tucked in near your ribs. Lift a few inches, hold a second, lower.",
        cue: "Thumbs up is the whole point — it rotates the shoulder outwards and lets the lower traps take the work. Lift by squeezing the shoulder blades, not by shrugging or arching. Height doesn't matter." },
      { name: "External rotation", kit: "band",
        options: [
          { name: "Banded", fig: "extRotation", dose: "3 × 12 / side",
            body: "Elbow tucked at your side and bent to ninety degrees, band anchored across your body. Rotate the forearm outwards without letting the elbow drift off your ribs.",
            cue: "Slow in both directions. The return is half the exercise." },
          { name: "Side-lying", fig: "sideLyingER", dose: "3 × 12 / side",
            body: "Lie on your side with the working arm on top, elbow pinned to your ribs and bent to ninety degrees, holding a light dumbbell or a full water bottle. Rotate the forearm up towards the ceiling, then lower slowly. Gravity provides the resistance, so there is nothing to anchor.",
            cue: "Very light. A one-kilo weight is plenty here, and going heavier just recruits everything except the muscle you are trying to reach." },
        ] },
      { fig: "latStretch", name: "Kneeling lat stretch", dose: "2 × 30s", kit: "none",
        body: "Kneel in front of a bench, chair seat or sofa arm with your hips stacked over your knees. Rest both elbows on it at about shoulder width, thumbs up, then let your chest sink towards the floor and your head drop between your arms. You should feel it down the outside of your ribs and into the armpit. No bench to hand? Stand an arm's length from a wall, hands high on it, and hinge at the hips instead. And if you do have a pull-up bar, a 30-second dead hang afterwards is worth adding — it decompresses the joint in a way this doesn't.",
        cue: "Keep the hips back over the knees — creeping forwards turns it into a lower-back stretch instead. Tight lats are a big part of what stops the arm getting properly overhead on a serve." },
      { fig: "tSpine", name: "Thoracic extension over roller", dose: "3–4 spots × 5", kit: "none",
        body: "Roller across the mid-back, hands supporting the head, hips on the floor. No roller? A tightly rolled bath towel does the same job, or sit in a dining chair and extend backwards over the top of the backrest. Extend backwards over it, then shift a couple of centimetres up the spine and repeat.",
        cue: "Stay below the shoulder blades and above the lower back. Keep the ribs from flaring." },
      { name: "Chest stretch", kit: "none",
        options: [
          { name: "Supine opener", fig: "chestOpener", dose: "2 min",
            body: "Lie back along a foam roller or a tightly rolled towel so it runs the full length of your spine, head supported at the top, knees bent and feet flat on the floor. Let your arms fall out to the sides at roughly shoulder height, palms up, and breathe. Gravity sets the dose — you aren't pulling into anything.",
            cue: "Slower, and almost impossible to overdo. If your shoulders don't reach the floor, that's the information, not a failure — rest them on cushions and let them sink over the two minutes." },
          { name: "Doorway", fig: "pecStretch", dose: "2 × 30s / side",
            body: "Stand at a doorway or a fence post. Put your forearm flat against the frame with the elbow at about shoulder height, then step the same-side foot through the gap and turn your chest away from the arm. It should pull across the front of the chest, never inside the shoulder joint.",
            cue: "Quicker, but much easier to overdo. Back off the moment you feel anything pinching at the front of the shoulder, and lower the elbow a little if it keeps happening." },
        ] },
    ],
    alt: {
      label: "Band + floor",
      time: "≈30 min",
      note: "One long resistance band, a towel, and something to anchor to — court fencing, a net post, a door. This is a whole session, not a watered-down one: the pulling volume is the same, just spread across three lighter movements instead of two heavier ones.",
      exercises: [
        { fig: "invertedRow", name: "Inverted row", dose: "3 × 8–12", kit: "none",
          body: "A properly loaded horizontal pull that needs nothing but something to lie under. Find any waist-height horizontal bar — a low fence rail, a picnic table edge, the underside of a sturdy railing. Lie beneath it, body dead straight from head to heels, and pull your chest up to the bar.",
          cue: "Feet further out or up on a bench makes it harder; knees bent with feet under you makes it easier. Adjust the angle, not the rep count." },
        { fig: "bandPulldown", name: "Band lat pulldown", dose: "3 × 12", kit: "band",
          body: "Loop the band over something high — the top rail of court fencing, a branch, a door anchor — and kneel underneath it, tall through the hips. Pull the band down to your collarbone, pause, and let it back up slowly under control.",
          cue: "Shoulder blades down before the elbows bend. Tall kneeling stops you cheating with your legs." },
        { fig: "bandRow", name: "Band single-arm row", dose: "3 × 12 / side", kit: "band",
          body: "Anchor the band at waist height and step back until there's tension with your arm straight. Row the handle to your hip, letting the shoulder blade travel, then return slowly with the arm reaching forward at the end.",
          cue: "Stay square to the anchor. If your torso is rotating to help, step in and lose some tension." },
        { fig: "pullApart", name: "Band pull-apart", dose: "3 × 15", kit: "band",
          body: "Arms straight out in front, stretch the band across your chest until it touches, then return slowly. High reps, light tension.",
          cue: "No band? Hold a towel taut and pull outwards against it for five seconds a rep. Isometric, but it reaches the same muscles." },
        { fig: "ytw", name: "Prone Y–T–W", dose: "2 × 8 each shape", kit: "none",
          body: "Three separate exercises done back to back, not one flowing movement — finish all the reps of one shape before changing to the next, resetting your arms on the floor in between. Lie face down with your forehead resting on the floor and your thumbs pointing at the ceiling the whole time. Y: arms overhead in a narrow V. T: arms straight out to the sides. W: elbows tucked in near your ribs. Lift a few inches, hold a second, lower.",
          cue: "Thumbs up is the whole point — it rotates the shoulder outwards and lets the lower traps take the work. This one never needed equipment in the first place." },
        { fig: "extRotation", name: "Banded external rotation", dose: "3 × 12 / side", kit: "band",
          body: "Elbow tucked to your side and bent to ninety degrees, band anchored across your body at elbow height. Rotate the forearm outwards without letting the elbow drift off your ribs.",
          cue: "Slow in both directions. The return is half the exercise." },
        { fig: "latStretch", name: "Kneeling lat stretch", dose: "2 × 30s", kit: "none",
          body: "Kneel in front of a bench, chair seat or sofa arm with your hips stacked over your knees. Rest both elbows on it at about shoulder width, thumbs up, then let your chest sink towards the floor and your head drop between your arms.",
          cue: "Hips stay back over the knees — creeping forwards turns it into a lower-back stretch. No bench? Hands high on a wall and hinge at the hips instead." },
        { fig: "tSpine", name: "Thoracic extension over a rolled towel", dose: "3–4 spots × 5", kit: "none",
          body: "Roll a bath towel up tight and lie back over it, hands supporting your head, hips on the floor. Extend backwards, then shift the towel a couple of centimetres up the spine and repeat.",
          cue: "Stay below the shoulder blades and above the lower back. A rolled towel is genuinely fine here — a foam roller is convenience, not necessity." },
        { name: "Chest stretch", kit: "none",
          options: [
            { name: "Supine opener", fig: "chestOpener", dose: "2 min",
              body: "Lie back along a foam roller or a tightly rolled towel so it runs the full length of your spine, head supported at the top, knees bent and feet flat on the floor. Let your arms fall out to the sides at roughly shoulder height, palms up, and breathe. Gravity sets the dose — you aren't pulling into anything.",
              cue: "Slower, and almost impossible to overdo. If your shoulders don't reach the floor, that's the information, not a failure — rest them on cushions and let them sink over the two minutes." },
            { name: "Doorway", fig: "pecStretch", dose: "2 × 30s / side",
              body: "Stand at a doorway or a fence post. Put your forearm flat against the frame with the elbow at about shoulder height, then step the same-side foot through the gap and turn your chest away from the arm. It should pull across the front of the chest, never inside the shoulder joint.",
              cue: "Quicker, but much easier to overdo. Back off the moment you feel anything pinching at the front of the shoulder, and lower the elbow a little if it keeps happening." },
          ] },
      ],
    },
  },
  {
    n: 3,
    short: "Mobility",
    title: "Mobility",
    sub: "Mobility & active recovery",
    time: "≈30 min",
    load: 1,
    focus:
      "The day that makes the other six possible. Nothing loaded, nothing timed against a target. Take it after a heavy coaching block.",
    exercises: [
      { fig: "deepSquat", name: "Deep squat hold", dose: "3 × 60s", kit: "none",
        body: "Sink to the bottom of a bodyweight squat with the heels down and live there. Tipping backwards? Hold a door frame or a light kettlebell as a counterweight — a legitimate long-term version, not a cheat.",
        cue: "Elbows inside the knees, gently pushing out. Breathe out and sink a little further each time." },
      { fig: "wgs", name: "World's greatest stretch", dose: "5 / side", kit: "none",
        body: "Long lunge, drop the opposite elbow towards the inside of the front foot, then rotate the top arm open to the ceiling and follow it with your eyes.",
        cue: "Rear leg long and the back knee off the floor — that's what keeps the hip flexor in it." },
      { fig: "needle", name: "Thread the needle", dose: "8 / side", kit: "none",
        body: "On all fours, reach one arm under your body and across, then unwind and open to the ceiling. Pure thoracic rotation — the range your serve borrows from.",
        cue: "Hips stay stacked over the knees. If they swing, the rotation is coming from your lower back." },
      { fig: "pigeon", name: "Pigeon", dose: "60s / side", kit: "none",
        body: "Front shin angled across in front, back leg long behind. Keep the hips square rather than collapsing onto one side.",
        cue: "Breathe out into it rather than pushing. A cushion under the front hip is fine." },
      { fig: "floss", name: "Hamstring floss", dose: "10 / side", kit: "none",
        body: "On your back with one leg raised, straighten the knee as you pull the toes towards you, then bend the knee as you point them away. It glides the nerve rather than stretching the muscle.",
        cue: "Never push into tingling. This should feel like gentle sliding, not a stretch." },
      { fig: "ankle", name: "Wall ankle dorsiflexion", dose: "10 / side", kit: "none",
        body: "Foot a few centimetres from a wall, drive the knee over the toes until it touches — without the heel lifting. Edge the foot back and repeat.",
        cue: "Measure the gap and chase an extra centimetre. Ankle range decides how well you load a low volley." },
    ],
    note: "Finish with an easy 20–30 min walk or swim if you fancy it. Conversational pace only — if you're breathing hard it's stopped being recovery.",
  },
  {
    n: 4,
    short: "Power",
    title: "Lower power",
    sub: "Lower power + rotational core",
    time: "≈35 min",
    load: 4,
    focus:
      "The day that transfers most directly onto court. If the movements get slow or sloppy the session is over, regardless of what's left on the list.",
    exercises: [
      { fig: "pogo", name: "Pogo hops", dose: "3 × 20", kit: "none",
        body: "Stiff ankles, barely any knee bend, bounce off the floor as though it's too hot to stand on. Trains the tendon stiffness that makes a split-step cheap.",
        cue: "Quiet landings. Noise is energy you've absorbed instead of returned." },
      { fig: "bound", name: "Lateral bound — stick the landing", dose: "3 × 5 / side", kit: "none",
        body: "Push off one leg sideways, land on the other, hold completely still for two seconds before resetting. The pause is the entire exercise — it's the control that lets you change direction on a wide ball.",
        cue: "Watch the landing knee, not the distance. If it collapses inwards, shorten the bound." },
      { fig: "skater", name: "Skater jumps", dose: "3 × 8 / side", kit: "none",
        body: "Same movement, continuous — land and immediately push back the other way. Adds the elastic quality on top of the control. Only once the bounds are solid.",
        cue: "Minimum ground contact. The floor is something to bounce off, not land on." },
      { name: "Rotational power", kit: "band",
        options: [
          { name: "Med ball throw", fig: "medBall", dose: "4 × 6 / side",
            body: "Stand side-on to a solid wall a couple of metres away, feet planted and about shoulder-width apart. Wind the ribcage back away from the wall, then throw the ball into it by turning the hips first and letting the chest, then the arms, follow. Collect it and reset properly between reps — this is a power exercise, so rest if you need to.",
            cue: "Hips lead, chest follows, arms last. Exactly the sequence of your forehand, which is the whole point. Needs a wall you're actually allowed to throw at — outside brick or a gym wall, not plasterboard." },
          { name: "Band chop", fig: "bandChop", dose: "4 × 8 / side",
            body: "Anchor a band at roughly chest height — court fencing, a fence post, a door anchor. Stand side-on with your arms extended towards it, wind back against the tension, then rotate away fast by turning the hips first. Control the way back rather than letting the band snap you round.",
            cue: "Same sequence, same intent, and it works anywhere. What it loses is the release: you can't actually let go, so the very top-end speed is lower. Go for genuinely fast rotation rather than heavy tension to close the gap." },
        ] },
      { fig: "pallof", name: "Pallof press", dose: "3 × 12 / side", kit: "band",
        body: "Band at chest height off to your side. Press the handle straight out, hold a beat, bring it back. Pressing out lengthens the lever and multiplies the twist trying to turn you.",
        cue: "Hips, ribs and eyes face straight ahead. If anything moves except your arms, step closer to the anchor." },
      { fig: "deadBug", name: "Dead bug", dose: "3 × 10 / side", kit: "none",
        body: "On your back, arms up and knees over hips. Lower the opposite arm and leg while pressing your lower back into the floor, then return under control.",
        cue: "The moment your lower back lifts off the floor you've gone too far. Shorten the reach." },
    ],
  },
  {
    n: 5,
    short: "Push",
    title: "Upper push",
    sub: "Upper push + anti-rotation",
    time: "≈35 min",
    load: 3,
    focus:
      "Pressing strength kept deliberately modest, plus the trunk work that stops your lower back doing your shoulder's job.",
    exercises: [
      { name: "Horizontal press", kit: "none",
        options: [
          { name: "Push-up", fig: "pushUp", dose: "3 × 10",
            body: "The better default of the two, because your shoulder blades stay free to move across your ribs instead of being pinned flat against a bench. Hands about shoulder-width, body in one rigid line from head to heels, and lower until your chest is roughly a fist's height off the floor. If ten clean reps aren't there yet, put your hands on a bench or a step — that's a legitimate progression, not a lesser exercise.",
            cue: "Elbows at roughly 45° to your body, not flared out to 90°. Squeeze the glutes so your hips don't sag as you tire." },
          { name: "Dumbbell bench", fig: "dbBench", dose: "3 × 10",
            body: "Lie flat on a bench with your feet planted on the floor, holding a dumbbell in each hand at the outside of your shoulders. Press them up until your arms are straight, then lower under control until your upper arms are level with your torso. Dumbbells rather than a barbell because each arm works independently, so your stronger side can't quietly take over, and your wrists can rotate to whatever angle your shoulder prefers.",
            cue: "Keep your ribs down and your feet flat — arching to move more weight turns it into a decline press and puts the load through your lower back. Go lighter than feels impressive; this is a support day, not a chest day." },
        ] },
      { name: "Half-kneeling press", kit: "weights",
        options: [
          { name: "Dumbbell", fig: "hkPress", dose: "3 × 8 / side",
            body: "Kneel on one knee, press with the arm on the same side as the down knee. The narrow base removes any chance of using your legs or arching your back, so what's left is honest shoulder strength.",
            cue: "At the top the weight sits above the shoulder, above the hip. Drifting in front of your face? Lighten it." },
          { name: "Band", fig: "bandOhPress", dose: "3 × 12 / side",
            body: "Same half-kneeling position, with a band trapped under your front foot instead of a dumbbell in your hand. Press the handle overhead until the arm is straight, then lower under control against the tension.",
            cue: "Band tension increases as you press, which is the opposite of a dumbbell — expect the top of the rep to feel hardest. Rear glute stays squeezed throughout." },
        ] },
      { name: "Angled press", kit: "weights",
        options: [
          { name: "Incline press", fig: "inclinePress", dose: "3 × 10",
            body: "Set a bench to roughly 45 degrees — halfway between flat and upright. Press a pair of dumbbells from the outside of your shoulders up to arm's length. The angle matters: a flat bench works the chest hardest, straight overhead works the shoulder hardest, and this sits between the two, which is kinder to a shoulder already doing a week's worth of serving.",
            cue: "Stop the descent when your upper arms are level with your torso, not below it. Going deeper adds nothing and loads the front of the shoulder in the position it likes least." },
          { name: "Landmine press", fig: "landmine", dose: "3 × 10 / side",
            body: "A landmine is just one end of a barbell wedged into a corner or a purpose-made floor socket, so the bar swings on a fixed pivot instead of moving freely. You load the far end, hold it at your shoulder with both hands or one, and press it up and away from you along the arc the bar wants to travel. Because the pivot carries part of the weight and the path is fixed, your shoulder doesn't have to stabilise in every direction at once — which is why it's the version to reach for if anything is grumbling.",
            cue: "No barbell? Wedge one end in a corner with a towel to protect the wall, or use a single dumbbell pressed up and forwards on the same diagonal. The arc is the point, not the equipment." },
        ] },
      { fig: "wallSlide", name: "Serratus wall slides", dose: "2 × 10", kit: "none",
        body: "Stand facing a wall with the whole length of both forearms flat against it — elbow, forearm and the little-finger edge of each hand all in contact, elbows at about shoulder height and shoulder width apart. Keeping that contact the entire time, slide the forearms up the wall while pressing into it, and at the top push your shoulder blades forward as if trying to shove the wall away. That last reach is the bit that matters.",
        cue: "If your elbows lift off the wall as you slide, you have gone as far as your shoulders currently allow — stop there rather than letting them drift. Ribs stay down too; it is easy to fake the range by arching your back." },
      { name: "Suitcase carry", kit: "weights",
        options: [
          { name: "Walking", fig: "carry", dose: "3 × 30m / side",
            body: "One heavy dumbbell, kettlebell or loaded bag in one hand. Walk in a straight line without leaning away from it, then swap sides. Deceptively simple, brutally effective for the obliques, and it costs almost nothing in recovery.",
            cue: "Shoulders stay level. Film yourself once — everyone tilts more than they think. Needs about 30m of clear space, so a garden, corridor, car park or the court itself." },
          { name: "Static hold", fig: "carryHold", dose: "3 × 40s / side",
            body: "Same exercise without the walking. Stand tall holding something heavy in one hand and simply resist being pulled sideways for 30 to 45 seconds, then swap. Squeeze the free hand into a fist to help you brace.",
            cue: "Works in a hallway or a hotel room, and it's the version to use if you're carrying anything that makes walking with load awkward. Go heavier than you would for the walk, since there's no distance to accumulate." },
        ] },
      { fig: "sidePlank", name: "Side plank", dose: "3 × 30s / side", kit: "none",
        body: "Elbow under the shoulder, body in a straight line, hips lifted. Stack the feet for the full version, stagger them while you build up.",
        cue: "Push the floor away with the bottom shoulder rather than sagging into the joint." },
    ],
  },
  {
    n: 6,
    short: "Circuit",
    title: "Full-body circuit",
    sub: "Three to four rounds",
    time: "≈25 min",
    load: 3,
    focus:
      "60–90 seconds' rest between rounds, as little as possible within them. Tops up weekly volume — it isn't here to wreck you.",
    exercises: [
      { fig: "goblet", name: "Goblet squat", dose: "× 12", kit: "weights",
        body: "Kettlebell, dumbbell or a loaded rucksack hugged to your chest, elbows tracking down inside the knees at the bottom. The front-loaded position keeps you upright and largely self-corrects your squat.",
        cue: "Sit between your feet rather than folding forward over them." },
      { fig: "pushUp", name: "Push-up", dose: "× 12", kit: "none",
        body: "Same standard as Day 5. When fatigue arrives mid-circuit, switch to hands on a bench rather than letting the hips sag.",
        cue: "Stop the set when the line breaks. Half a set of good reps beats a full set of bad ones." },
      { name: "Single-arm row", kit: "weights",
        options: [
          { name: "Dumbbell row", fig: "row", dose: "× 10 / side",
            body: "Bench-supported or bent over. Keep it slightly lighter than Day 2 — you're already fatigued and this isn't the session to chase a number.",
            cue: "Ribcage square, no twisting to help the weight up." },
          { name: "Band row", fig: "bandRow", dose: "× 12 / side",
            body: "Band anchored at waist height, step back to tension, row the handle to your hip and return slowly. Easier to set up mid-circuit than dragging a dumbbell around.",
            cue: "Same rule: stay square to the anchor, no twisting to help the handle back." },
        ] },
      { name: "Hip snap", kit: "weights",
        options: [
          { name: "Kettlebell swing", fig: "swing", dose: "× 15",
            body: "A hinge, not a squat, and definitely not a front raise. The bell floats up because your hips snapped through, and stops around chest height.",
            cue: "The bell should feel weightless at the top. Straining there means you're lifting it, not throwing it." },
          { name: "Band pull-through", fig: "pullThrough", dose: "× 20",
            body: "Anchor a band low behind you, step forward and pass the handle between your legs. Hinge at the hips with the band pulling you backwards, then snap the hips forward to stand tall. Same pattern as a swing, no bell needed.",
            cue: "Squeeze the glutes hard at the top rather than leaning back. The band pulls you into the hinge, so you get resistance in the direction that actually matters." },
        ] },
      { fig: "plank", name: "Plank", dose: "45s", kit: "none",
        body: "Squeeze the glutes and brace as though about to take a punch, rather than just hanging out in the position.",
        cue: "Hips slightly tucked under — not sagging, not piked up in the air." },
    ],
    note: "If the week ran long on court, swap this for a second Day 3 and don't think twice. Five sessions plus a fresh body beats six and a flat one.",
  },
  {
    n: 7,
    short: "Rest",
    title: "Rest",
    sub: "Properly",
    time: "—",
    load: 0,
    focus:
      "Nothing structured. The adaptation from the previous six days happens now rather than during them.",
    exercises: [],
  },
];

const PRINCIPLES = [
  { k: "Your court hours are training too",
    v: "A week of feeding balls, demoing strokes and standing on hard courts is a real physical load, and this plan sits on top of it rather than instead of it. So when the coaching week runs long, the gym work is what gives — never the court work. Six sessions is what's written down; five plus a body that isn't flat is the better week." },
  { k: "Consistency, not intensity",
    v: "Four honest sessions a week for six months beats six brilliant ones for three weeks and then nothing. Treat this as a cycle rather than a calendar: miss Wednesday and Day 3 happens on Thursday, it doesn't get skipped. Write the weights down as you go — two numbers per exercise is enough, and without them you'll sit at the same load for months without noticing." },
  { k: "Tennis first on shared days",
    v: "Court session first, gym after, four hours between if the schedule allows. Lifting beforehand blunts the quality of your movement on court, which is the thing you actually care about. Stretching follows the same logic: held stretches temporarily reduce power output, so they belong at the end of a session or on Day 3. Before court, everything is dynamic." },
  { k: "Sleep outranks everything else here",
    v: "Including everything else on this list. Nothing in this plan compensates for six hours a night — not the mobility day, not the foam rolling, not the protein. If you're only going to fix one thing, fix this one and the rest gets easier on its own." },
  { k: "Tendons lag behind muscle",
    v: "Muscle adapts in weeks; tendon takes months. That gap is where most training injuries live — you get strong enough to produce force your tendons aren't yet ready to absorb. It's why every lowering phase in here is deliberately slow, and why you deload every fifth or sixth week by halving the sets and keeping the weight the same." },
  { k: "Protein, then everything else",
    v: "Around 1.6g per kilogram of bodyweight a day is where most of the research lands, spread across meals rather than loaded into one. For lean mass it's the only nutrition variable worth tracking, and no amount of training makes up for missing it." },
];

const DISCLAIMER = {
  lead:
    "This is general training guidance written for healthy adults. It isn't medical advice, it isn't physiotherapy, and it isn't a programme built around you — the plan doesn't know your injury history, your medical background or how you actually move.",
  points: [
    { k: "Check with a doctor first if any of this applies",
      v: "A heart condition, high blood pressure, pregnancy or recent post-partum, recent surgery, dizziness or chest pain on exertion, or any injury you're currently managing. If you're already under the care of a physio or a doctor, their plan takes precedence over this one — follow theirs and treat this as something to discuss with them." },
    { k: "The numbers are starting points, not prescriptions",
      v: "Every set, rep and hold in here assumes you scale it to your own level. If a load is too heavy, a rep count too high or a stretch too intense, change it. Nothing here is a target you owe anyone." },
    { k: "Know the difference between effort and pain",
      v: "Muscular burn during a set and mild soreness a day or two later are normal. Sharp pain, pain in a joint, pain that builds through a set, numbness, tingling, swelling, or anything that changes how you move are not. Stop, and get it looked at rather than training through it." },
    { k: "Warm up, and don't train through illness",
      v: "Five to ten minutes of easy movement before the strength and power days — Day 1, 4, 5 and 6 in particular. Skip training entirely if you're unwell, feverish, or badly sleep-deprived; you'll get nothing from the session and you'll delay recovery." },
    { k: "Exercise carries inherent risk",
      v: "Following this plan is something you do at your own risk, and no coach or programme can eliminate the possibility of injury. If in doubt about whether something is appropriate for you, the answer is to ask a qualified professional before you try it, not after." },
  ],
  foot:
    "Nothing in this plan constitutes medical advice, diagnosis or treatment, and it should not be used in place of professional assessment.",
};

function Chevron({ open }) {
  return (
    <svg viewBox="0 0 24 24" className={`w-4 h-4 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function LoadBar({ load, active }) {
  const pct = (load / LOAD_MAX) * 100;
  return (
    <div className={`w-full h-1 rounded-full overflow-hidden ${active ? "bg-white bg-opacity-30" : "bg-slate-100"}`}>
      <div className={`h-full rounded-full ${active ? "bg-white" : "bg-violet-400"}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function ExerciseCard({ ex, open, onToggle }) {
  // An exercise can offer two equal alternatives (e.g. two ways to stretch the
  // chest). The option carries the figure, dose and copy; the exercise carries
  // the umbrella name and the kit tag used for filtering.
  const [optIdx, setOptIdx] = useState(0);
  const opts = ex.options;
  const view = opts ? opts[Math.min(optIdx, opts.length - 1)] : ex;

  return (
    <div
      className={`bg-white rounded-2xl border transition-all duration-200 ${
        open ? "border-slate-200 border-l-4 border-l-violet-500 shadow-sm" : "border-slate-100"
      }`}
    >
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-3 p-3 text-left"
      >
        {!open && (
          <div className="w-16 h-14 shrink-0 rounded-xl bg-slate-50 flex items-center justify-center p-1">
            <Figure name={view.fig} className="w-full h-full" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900 leading-snug">{ex.name}</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs font-semibold text-violet-700 bg-violet-50 rounded-md px-2 py-0.5">
              {view.dose}
            </span>
            <span className="text-xs text-slate-400">{KIT_LABEL[ex.kit]}</span>
            {opts && (
              <span className="text-xs text-slate-400">
                · {opts.map((o) => o.name).join(" or ")}
              </span>
            )}
          </div>
        </div>
        <div className="text-slate-300">
          <Chevron open={open} />
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3">
          {opts && (
            <div className="flex gap-1 p-1 bg-slate-100 rounded-full mb-3">
              {opts.map((o, i) => (
                <button
                  key={o.name}
                  onClick={() => setOptIdx(i)}
                  className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                    i === optIdx ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                  }`}
                >
                  {o.name}
                </button>
              ))}
            </div>
          )}
          <div className="rounded-xl bg-slate-50 p-2 mb-3">
            <Figure name={view.fig} className="w-full h-auto" animate />
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">{view.body}</p>
          <div className="mt-3 rounded-xl bg-violet-50 p-3">
            <div className="text-xs font-bold uppercase tracking-wider text-violet-400 mb-1">Cue</div>
            <p className="text-sm text-violet-900 leading-snug">{view.cue}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrainingPlanPage() {
  const navigate = useNavigate();
  const [dayIdx, setDayIdx] = useState(0);
  const [kit, setKit] = useState("all");
  const [openEx, setOpenEx] = useState(null);
  const [version, setVersion] = useState("main");
  const [showPrinciples, setShowPrinciples] = useState(false);
  const stripRef = useRef(null);

  const day = DAYS[dayIdx];
  const usingAlt = version === "alt" && !!day.alt;
  const session = usingAlt ? day.alt : day;
  const exercises = session.exercises;
  const shown = exercises.filter((e) => kit === "all" || e.kit === kit);

  useEffect(() => {
    setOpenEx(null);
    setKit("all");
    setVersion("main");
    // On the rest day there's nothing else on screen, so lead with the principles.
    setShowPrinciples(DAYS[dayIdx].exercises.length === 0);
  }, [dayIdx]);

  useEffect(() => {
    setOpenEx(null);
  }, [kit, version]);

  const counts = {
    all: exercises.length,
    none: exercises.filter((e) => e.kit === "none").length,
    band: exercises.filter((e) => e.kit === "band").length,
    weights: exercises.filter((e) => e.kit === "weights").length,
  };

  const filters = [
    { id: "all", label: "All" },
    { id: "none", label: "Bodyweight" },
    { id: "band", label: "Band" },
    { id: "weights", label: "Weights" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-100">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            aria-label="Back"
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full hover:bg-slate-50 flex items-center justify-center text-slate-500 shrink-0"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-slate-900 leading-tight">Training</h1>
            <p className="text-xs text-slate-400">Off-court · 7-day plan</p>
          </div>
          <span className="text-xs font-semibold text-violet-700 bg-violet-50 rounded-full px-3 py-1.5 shrink-0">
            Between sessions
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-16">
        {/* Day strip */}
        <div className="pt-4">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-base font-bold text-slate-900">Your week</h2>
            <span className="text-xs text-slate-400">6 sessions · 1 rest</span>
          </div>
          <div ref={stripRef} className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
            {DAYS.map((d, i) => {
              const active = i === dayIdx;
              return (
                <button
                  key={d.n}
                  onClick={() => setDayIdx(i)}
                  className={`shrink-0 w-16 rounded-2xl border p-2 transition-colors ${
                    active
                      ? "bg-violet-600 border-violet-600 text-white shadow-sm"
                      : "bg-white border-slate-200 text-slate-900"
                  }`}
                >
                  <div className={`text-xs font-semibold uppercase tracking-wide ${active ? "text-violet-100" : "text-slate-400"}`}>
                    Day
                  </div>
                  <div className="text-xl font-bold leading-tight">{d.n}</div>
                  <div className={`text-xs truncate ${active ? "text-violet-100" : "text-slate-400"}`}>{d.short}</div>
                  <div className="mt-1.5">
                    <LoadBar load={d.load} active={active} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Day summary */}
        <div className="mt-3 bg-white rounded-2xl border border-slate-100 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-xl font-bold text-slate-900 leading-tight">{day.title}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{day.sub}</p>
            </div>
            <span className="shrink-0 text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-2.5 py-1">
              {session.time || day.time}
            </span>
          </div>
          <p className="mt-3 text-sm text-slate-600 leading-relaxed border-l-2 border-violet-400 pl-3">
            {day.focus}
          </p>
          <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
            <span>
              <span className="font-semibold text-slate-600">{exercises.length}</span> exercises
            </span>
            <span className="flex items-center gap-1.5">
              Load
              <span className="inline-flex gap-0.5">
                {[1, 2, 3, 4].map((i) => (
                  <span key={i} className={`w-1.5 h-1.5 rounded-full ${i <= day.load ? "bg-violet-500" : "bg-slate-200"}`} />
                ))}
              </span>
            </span>
          </div>
        </div>

        {/* Version toggle */}
        {day.alt && (
          <div className="mt-3">
            <div className="flex gap-1 p-1 bg-slate-100 rounded-full">
              {[
                { id: "main", label: day.kitLabel || "Full gym" },
                { id: "alt", label: day.alt.label },
              ].map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVersion(v.id)}
                  className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                    version === v.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
            {usingAlt && day.alt.note && (
              <p className="mt-3 text-sm text-slate-600 leading-relaxed border-l-2 border-slate-300 pl-3">
                {day.alt.note}
              </p>
            )}
          </div>
        )}

        {/* Filters */}
        {exercises.length > 0 && (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
            {filters.map((f) => {
              const active = kit === f.id;
              const c = counts[f.id];
              return (
                <button
                  key={f.id}
                  onClick={() => setKit(f.id)}
                  disabled={c === 0}
                  className={`shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium border transition-colors ${
                    active
                      ? "bg-slate-800 border-slate-800 text-white"
                      : c === 0
                      ? "bg-white border-slate-100 text-slate-300"
                      : "bg-white border-slate-200 text-slate-600"
                  }`}
                >
                  {f.label}
                  <span
                    className={`text-xs rounded-full px-1.5 ${
                      active ? "bg-white bg-opacity-20 text-white" : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {c}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Exercises */}
        <div className="mt-3 space-y-2">
          {exercises.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center">
              <div className="text-3xl mb-2">🎾</div>
              <h4 className="text-base font-bold text-slate-900">Nothing on today</h4>
              <p className="text-sm text-slate-500 mt-1 max-w-xs mx-auto">
                Foam roll if you feel like it, walk if you want to. Rest is part of the training, not a gap in it.
              </p>
            </div>
          )}

          {shown.map((ex, i) => (
            <ExerciseCard
              key={`${day.n}-${ex.fig}-${i}`}
              ex={ex}
              open={openEx === i}
              onToggle={() => setOpenEx(openEx === i ? null : i)}
            />
          ))}

          {exercises.length > 0 && shown.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center">
              <h4 className="text-base font-bold text-slate-900">No {KIT_LABEL[kit].toLowerCase()} work today</h4>
              <p className="text-sm text-slate-500 mt-1">Try another filter, or jump to a different day.</p>
            </div>
          )}
        </div>

        {day.note && (
          <div className="mt-3 rounded-2xl bg-white border border-slate-100 border-l-4 border-l-slate-300 p-4">
            <p className="text-sm text-slate-600 leading-relaxed">{day.note}</p>
          </div>
        )}

        {/* Principles */}
        <div className="mt-6 bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <button
            onClick={() => setShowPrinciples(!showPrinciples)}
            aria-expanded={showPrinciples}
            className="w-full flex items-center justify-between gap-3 p-4 text-left"
          >
            <div>
              <h3 className="text-base font-bold text-slate-900">Six things that outrank exercise choice</h3>
              <p className="text-xs text-slate-400 mt-0.5">Worth coming back to when a week goes sideways</p>
            </div>
            <span className="text-slate-300">
              <Chevron open={showPrinciples} />
            </span>
          </button>
          {showPrinciples && (
            <div className="px-4 pb-4 space-y-3">
              {PRINCIPLES.map((p, i) => (
                <div key={p.k} className="flex gap-3">
                  <span className="shrink-0 w-6 text-xs font-bold text-violet-400 pt-0.5">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">{p.k}</div>
                    <p className="text-sm text-slate-600 leading-relaxed">{p.v}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-base font-bold text-slate-900">Before you start</h3>
          <p className="mt-2 text-sm text-slate-600 leading-relaxed">{DISCLAIMER.lead}</p>
          <div className="mt-4 space-y-3">
            {DISCLAIMER.points.map((pt) => (
              <div key={pt.k}>
                <div className="text-sm font-semibold text-slate-900 leading-snug">{pt.k}</div>
                <p className="text-sm text-slate-600 leading-relaxed mt-0.5">{pt.v}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400 leading-relaxed">
            {DISCLAIMER.foot}
          </p>
        </div>
      </div>
    </div>
  );
}
