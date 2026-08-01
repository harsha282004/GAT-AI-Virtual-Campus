import { PanoramaNode } from "./PanoramaNode";

/** One floor (or future route — Annex, Back Door, Auditorium Entrance) as a
 * doubly linked list of PanoramaNode. Traversal is O(1) per step via
 * node.next/node.previous; random access by id is O(1) via the id map. */
export class PanoramaLinkedList {
  readonly name: string;
  head: PanoramaNode | null = null;
  tail: PanoramaNode | null = null;

  private readonly nodesById = new Map<string, PanoramaNode>();

  constructor(name: string) {
    this.name = name;
  }

  /** Appends a node to the tail, linking it <-> the current tail in both
   * directions. Entry orientations are per-direction: `forwardEntry` is what
   * this new node should show when walked into from the previous tail;
   * `backEntry` is what the previous tail should show when walked back into
   * from this new node. */
  append(
    node: PanoramaNode,
    forwardEntry: { yaw: number | null; pitch: number | null } = { yaw: null, pitch: null },
    backEntry: { yaw: number | null; pitch: number | null } = { yaw: null, pitch: null },
  ): void {
    if (this.nodesById.has(node.sceneId)) {
      throw new Error(`PanoramaLinkedList[${this.name}]: duplicate sceneId "${node.sceneId}"`);
    }
    this.nodesById.set(node.sceneId, node);

    if (this.tail) {
      this.tail.next = { node, entryYaw: forwardEntry.yaw, entryPitch: forwardEntry.pitch };
      node.previous = { node: this.tail, entryYaw: backEntry.yaw, entryPitch: backEntry.pitch };
    } else {
      this.head = node;
    }
    this.tail = node;
  }

  get(sceneId: string): PanoramaNode | undefined {
    return this.nodesById.get(sceneId);
  }

  get size(): number {
    return this.nodesById.size;
  }

  toArray(): PanoramaNode[] {
    const out: PanoramaNode[] = [];
    let cursor = this.head;
    while (cursor) {
      out.push(cursor);
      cursor = cursor.next?.node ?? null;
    }
    return out;
  }
}
