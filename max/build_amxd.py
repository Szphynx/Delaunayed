#!/usr/bin/env python3
# Wrap dlny.maxpat into a real Max for Live device: dlny.amxd
#
# The .amxd container format is transcribed from py2max's m4l.py, which
# reverse-engineered it byte-for-byte against real Max-exported devices
# (https://github.com/shakfu/py2max, docs/notes/amxd.md). An .amxd is:
#   36-byte header  +  NUL-terminated UTF-8 patcher JSON  +  IFF dependency trailer
# and the patcher JSON MUST carry a `project` block or Max refuses to load it.
#
#   run:  python3 build_amxd.py        (after build_patches.py has written dlny.maxpat)
import json, struct, time, sys, os

MAGIC = b"ampf"; VERSION = 4; PTCH = b"ptch"; MXAC = b"mx@c"
MXAC_CONST = 16; MXAC_FLAGS = 0; MXAC_PREAMBLE = 16
OF32, VERS, FLAG, TYPE_PAYLOAD = 16, 0, 17, b"JSON"
MAX_EPOCH_OFFSET = 2_082_844_800
DEVICE_TYPES = {"audio_effect": b"aaaa", "instrument": b"iiii", "midi_effect": b"mmmm"}

def unix_to_max_time(t=None):
    return int(time.time() if t is None else t) + MAX_EPOCH_OFFSET

def _pad4(p):        return p + b"\x00" * ((-len(p)) % 4)
def _chunk(tag, p):  return tag + struct.pack(">I", 8 + len(p)) + p          # FOURCC + BE size(incl 8) + payload
def _u32(tag, v):    return _chunk(tag, struct.pack(">I", v))

def ensure_project_block(doc, device_type, mtime):
    inner = doc.get("patcher", doc)
    if "project" in inner:
        return doc
    amxdtype = struct.unpack(">I", DEVICE_TYPES[device_type])[0]     # "aaaa" -> 0x61616161
    inner["project"] = {
        "version": 1, "creationdate": mtime, "modificationdate": mtime,
        "viewrect": [0.0, 0.0, 300.0, 500.0], "autoorganize": 1, "hideprojectwindow": 1,
        "showdependencies": 1, "autolocalize": 0, "contents": {"patchers": {}},
        "layout": {}, "searchpath": {}, "detailsvisible": 0, "amxdtype": amxdtype,
        "readonly": 0, "devpathtype": 0, "devpath": ".", "sortmode": 0,
        "viewmode": 0, "includepackages": 0,
    }
    return doc

def pack_amxd(patcher_json, device_type="audio_effect", patcher_filename="dlny.maxpat", mtime=None):
    tag = DEVICE_TYPES[device_type]
    json_bytes = patcher_json.encode("utf-8") if isinstance(patcher_json, str) else patcher_json
    json_block = json_bytes + b"\x00"
    mxac_content_size = MXAC_PREAMBLE + len(json_block)
    if mtime is None:
        mtime = unix_to_max_time()
    dire = b"".join([
        _chunk(b"type", TYPE_PAYLOAD),
        _chunk(b"fnam", _pad4(patcher_filename.encode("utf-8") + b"\x00")),
        _u32(b"sz32", len(json_block)),
        _u32(b"of32", OF32), _u32(b"vers", VERS), _u32(b"flag", FLAG), _u32(b"mdat", mtime),
    ])
    dlst = _chunk(b"dlst", _chunk(b"dire", dire))
    header_top = MAGIC + struct.pack("<I", VERSION) + tag + PTCH
    ptch_payload_size = 16 + len(json_block) + len(dlst)                 # 4 tags*4B + json + trailer
    mxac_block = MXAC + struct.pack(">I", MXAC_CONST) + struct.pack(">I", MXAC_FLAGS) \
        + struct.pack(">I", mxac_content_size) + json_block
    return header_top + struct.pack("<I", ptch_payload_size) + mxac_block + dlst

def unpack_amxd(data):                                                   # verifier: mirror of pack
    assert data[0:4] == MAGIC, "bad magic"
    assert struct.unpack("<I", data[4:8])[0] == VERSION, "bad version"
    tag = data[8:12]; assert tag in DEVICE_TYPES.values(), "bad device tag"
    assert data[12:16] == PTCH and data[20:24] == MXAC, "bad chunk tags"
    mxac_content_size = struct.unpack(">I", data[32:36])[0]
    json_len = mxac_content_size - MXAC_PREAMBLE
    return data[36:36 + json_len - 1], tag                              # strip trailing NUL

if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    src = os.path.join(here, "dlny.maxpat"); out = os.path.join(here, "dlny.amxd")
    doc = json.load(open(src))
    mtime = unix_to_max_time()
    ensure_project_block(doc, "audio_effect", mtime)
    payload = json.dumps(doc, indent=1)
    data = pack_amxd(payload, "audio_effect", "dlny.maxpat", mtime)
    # self-check: round-trip the JSON back out of the container
    got, tag = unpack_amxd(data)
    assert json.loads(got) == doc, "round-trip mismatch!"
    assert tag == b"aaaa", "device tag not audio effect"
    with open(out, "wb") as f:
        f.write(data)
    print(f"wrote {out}  ({len(data)} bytes)")
    print(f"  device type : audio_effect (aaaa)")
    print(f"  header magic : {data[0:4]!r}  version={struct.unpack('<I', data[4:8])[0]}  tag={data[8:12]!r}  {data[12:16]!r}")
    print(f"  json bytes   : {len(payload.encode())}   project block: {'project' in doc['patcher']}")
    print(f"  round-trip   : OK (JSON extracted from container == source)")
