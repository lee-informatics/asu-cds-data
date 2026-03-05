library WeightManagementMedication version '0.3.0'

using FHIR version '4.0.1'
include FHIRHelpers version '4.0.1'

// ValueSet resources derived from those provided by Clinical Architecture
valueset "CardiovascularDiseases" : 'https://asu.edu/fhir/ValueSet/cardiovascular-diseases'
valueset "DiabetesMellitusType2" : 'https://asu.edu/fhir/ValueSet/diabetes-mellitus-type-2'
valueset "DyslipidemiaAll" : 'https://asu.edu/fhir/ValueSet/dyslipidemia-all'
valueset "HeartFailureWithPreservedEjectionFraction" : 'https://asu.edu/fhir/ValueSet/heart-failure-with-preserved-ejection-fraction'
valueset "HypertensionPrimary" : 'https://asu.edu/fhir/ValueSet/hypertension-primary'
valueset "MetabolicDysfunctionAssociatedSteatoticLiverDisease" : 'https://asu.edu/fhir/ValueSet/metabolic-dysfunction-associated-steatotic-liver-disease'
valueset "MetabolicSyndrome" : 'https://asu.edu/fhir/ValueSet/metabolic-syndrome'
valueset "Osteoarthritis" : 'https://asu.edu/fhir/ValueSet/osteoarthritis'
valueset "SleepApneaObstructive" : 'https://asu.edu/fhir/ValueSet/sleep-apnea-obstructive'

// Custom inline/hardcoded ValueSet definitions that should be changed to resolve against an external terminology servers at runtime.
codesystem "SNOMED" : 'http://snomed.info/sct'
codesystem "LOINC" : 'http://loinc.org'
//codesystem "ConditionClinicalStatus": 'http://terminology.hl7.org/CodeSystem/condition-clinical'
//codesystem "ConditionVerificationStatus": 'http://terminology.hl7.org/CodeSystem/condition-ver-status'

code "BMI LOINC" : '39156-5' from "LOINC" display 'Body mass index (BMI) [Ratio]'

context Patient

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

define function EstablishedCardiovascularDiseases():
  [Condition : "CardiovascularDiseases"] C where exists(C.clinicalStatus.coding CSCode where CSCode.code ~ 'active')

  // Exposed Expressions

define HasBMIOver40 :
  HasBMIOver(40.0 'kg/m2')

define HasBMI35To40 :
  HasBMIBetween(35.0 'kg/m2', 40.0 'kg/m2')

define HasBMI30To35 :
  HasBMIBetween(30.0 'kg/m2', 35.0 'kg/m2')

define HasBMI27To30 :
  HasBMIBetween(27.0 'kg/m2', 30.0 'kg/m2')

define BMI :
  MostRecentBMI()

define LatestBMI :
  MostRecentBMI()

define WeightRelatedConditions :
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

define IsTier1a :
  // TODO
  false

define IsTier1b :
  AgeInYears()>= 45
  and Exists(EstablishedCardiovascularDiseases())
  and(HasBMI27To30 or HasBMI30To35 or HasBMI35To40 or HasBMIOver40)

  //define IsTier3 :
  //  IsTier3i  or IsTier3ii   or IsTier3iii