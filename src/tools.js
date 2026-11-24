// Tools & skills shown with logos (marquee + skills). Brand logos: simple-icons (CC0) / devicon (MIT).
import { Bot, Cctv, Cpu, Landmark, Sigma } from 'lucide-react'
import autodesk from './assets/logos/autodesk.svg'
import autocad from './assets/logos/autocad.svg'
import fusion from './assets/logos/fusion.svg'
import python from './assets/logos/python.svg'
import matlab from './assets/logos/matlab.svg'
import labview from './assets/logos/labview.svg'
import blender from './assets/logos/blender.svg'

export const SOFTWARE = [
  { name: 'Autodesk Inventor', img: autodesk },
  { name: 'AutoCAD', img: autocad },
  { name: 'Fusion 360', img: fusion },
  { name: 'Mathcad', Icon: Sigma },
  { name: 'Python', img: python },
  { name: 'MATLAB', img: matlab },
  { name: 'LabVIEW', img: labview },
  { name: 'Blender', img: blender },
  { key: 'plc', Icon: Cpu },
]

/** Marquee items; `key` entries get a translated name from i18n `tools`. */
export const MARQUEE = [
  ...SOFTWARE,
  { key: 'atm', Icon: Landmark },
  { name: 'Hikvision CCTV', Icon: Cctv },
  { key: 'robotics', Icon: Bot },
]

export { autodesk as autodeskLogo, blender as blenderLogo }
