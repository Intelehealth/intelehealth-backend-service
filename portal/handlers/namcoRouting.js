/**
 * Checks whether a queue visit matches the requesting doctor's speciality.
 * Routed NAMCO visits match on routingSpeciality; otherwise, match on speciality.
 * @param { { speciality?: string, routingSpeciality?: string } } visit - Queue row
 * @param { string } speciality - Speciality of the doctor requesting the queue
 * @return { boolean }
 */
function matchesEffectiveSpeciality(visit, speciality) {
  return visit?.routingSpeciality ? visit.routingSpeciality == speciality : visit?.speciality == speciality;
}

module.exports = { matchesEffectiveSpeciality };
