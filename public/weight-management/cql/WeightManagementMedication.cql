// Implementation of decision table from "Guidance for Managing Scarce Weight Management Medication Resources in VA"
// clinical guidelines document dated May, 2024, as published by U.S. Department of Veterans Affairs.
//
// Implementation Notes
//
// All BMI-related expressions will not be truthy if the Patient does not have any BMI observations.
// That is, all BMI-related logic will return false in the absense of explicit BMI evidence.
//
// Author: Preston Lee
//

library WeightManagementMedication version '0.5.0'

using FHIR version '4.0.1'
include FHIRHelpers version '4.0.1'

// These ValueSet resources have been  derived from those provided by the Clinical Architecture team
// providing support for the Symedical terminology infrastructure implemented at VA.
// Expansions of certain value sets are too long to inline into the library, and thus require runtime evaluation.
valueset "CardiovascularDiseases" : 'https://asu.edu/fhir/ValueSet/cardiovascular-diseases'
valueset "DiabetesMellitusType2" : 'https://asu.edu/fhir/ValueSet/diabetes-mellitus-type-2'
valueset "DyslipidemiaAll" : 'https://asu.edu/fhir/ValueSet/dyslipidemia-all'
valueset "HeartFailureWithPreservedEjectionFraction" : 'https://asu.edu/fhir/ValueSet/heart-failure-with-preserved-ejection-fraction'
valueset "HypertensionPrimary" : 'https://asu.edu/fhir/ValueSet/hypertension-primary'
valueset "MetabolicDysfunctionAssociatedSteatoticLiverDisease" : 'https://asu.edu/fhir/ValueSet/metabolic-dysfunction-associated-steatotic-liver-disease'
valueset "MetabolicSyndrome" : 'https://asu.edu/fhir/ValueSet/metabolic-syndrome'
valueset "Osteoarthritis" : 'https://asu.edu/fhir/ValueSet/osteoarthritis'
valueset "SleepApneaObstructive" : 'https://asu.edu/fhir/ValueSet/sleep-apnea-obstructive'

// Declarations for inline/hardcoded code references.
codesystem "LOINC" : 'http://loinc.org'
codesystem "SNOMED" : 'http://snomed.info/sct'

// HL7 value sets that can be used for additional Condition logic, if needed.
//codesystem "ConditionClinicalStatus": 'http://terminology.hl7.org/CodeSystem/condition-clinical'
//codesystem "ConditionVerificationStatus": 'http://terminology.hl7.org/CodeSystem/condition-ver-status'

code "BMI LOINC" : '39156-5' from "LOINC" display 'Body mass index (BMI) [Ratio]'

// Logic is intended to operate upon a single FHIR Patient subject at a time

context Patient

// Generic BMI-related functions

define function MostRecentBMI():
  Last([Observation : "BMI LOINC"] O
    where O.status in { 'final', 'amended', 'corrected' }
    and O.effective is not null
    sort by start of effective asc
  )

define function HasBMIOver(bmi System.Quantity):
  MostRecentBMI().value as Quantity > bmi

define function HasBMIBetween(low System.Quantity, high System.Quantity):
  MostRecentBMI().value as Quantity >= low
  and MostRecentBMI().value as Quantity < high

define function BMIValue():
  (MostRecentBMI().value as Quantity)bmi
  return ToString(bmi.value.value)+ ' ' + bmi.unit.value

  // Queries intended to directly align with the information concepts defined by the clinical guidelines

define function EstablishedCardiovascularDiseases():
  [Condition : "CardiovascularDiseases"] C where exists(C.clinicalStatus.coding CSCode where CSCode.code ~ 'active')

define function WeightRelatedConditions():
  [Condition] C where C.code in "CardiovascularDiseases"
    or C.code in "CardiovascularDiseases"
    or C.code in "DiabetesMellitusType2"
    or C.code in "DyslipidemiaAll"
    or C.code in "HeartFailureWithPreservedEjectionFraction"
    or C.code in "HypertensionPrimary"
    or C.code in "MetabolicDysfunctionAssociatedSteatoticLiverDisease"
    or C.code in "MetabolicSyndrome"
    or C.code in "Osteoarthritis"
    or C.code in "SleepApneaObstructive"

define function LiftThreateningWeightRelatedConditions():
  // TODO - Don't know what to query for!
  {} as List < Condition >

// Expressions automatically evaluated for the caller in FHIR Patient context

define HasBMIOver40 :
  HasBMIOver(40.0 'kg/m2')

define HasBMI35To40 :
  HasBMIBetween(35.0 'kg/m2', 40.0 'kg/m2')

define HasBMI30To35 :
  HasBMIBetween(30.0 'kg/m2', 35.0 'kg/m2')

define HasBMI27To30 :
  HasBMIBetween(27.0 'kg/m2', 30.0 'kg/m2')

define LatestBMI :
  MostRecentBMI()

  // Tier determinations as defined by the guidelines.
  // Important: Tiering determinations may incorrectly return false if the Patient does not have any BMI records,
  // as a specific BMI range is required for most categories.

define HighestTier :
  if IsTier1a then '1a'
  else if IsTier1b then '1b'
  else if IsTier2a then '2a'
  else if IsTier2b then '2b'
  else if IsTier2c then '2c'
  else if IsTier3 then '3'
  else null

define IsTier1a :
  Count(LiftThreateningWeightRelatedConditions())> 0

define IsTier1b :
  AgeInYears()>= 45
  and Exists(EstablishedCardiovascularDiseases())
  and(HasBMIOver(27.0 'kg/m2'))

define IsTier2a :
  (Count(WeightRelatedConditions())>= 3
    or exists [Condition: "HeartFailureWithPreservedEjectionFraction"]
  )
  and(HasBMIOver(27.0 'kg/m2'))

define IsTier2b :
  Count(WeightRelatedConditions())>= 2
  and(HasBMIOver(27.0 'kg/m2'))

define IsTier2c :
  Count(WeightRelatedConditions())>= 2
  and(HasBMIOver(27.0 'kg/m2'))

define IsTier3 :
  HasBMIOver(30.0 'kg/m2')

// Comment this out if we don't need it.
define AllWeightRelatedConditions:
  WeightRelatedConditions()
